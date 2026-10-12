/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */

/**
 * Quick, Docker-free check of this repo's Docker image builds.
 *
 * For every workspace with a `docker:build` script, this replays its Dockerfile against a
 * throwaway directory instead of a Docker daemon:
 *
 * 1. Build context: the files a fresh CI checkout would send (git-tracked plus untracked,
 *    non-ignored files), filtered through the context's .dockerignore.
 * 2. ARG / ENV / WORKDIR / COPY are interpreted per build stage, against a fake root
 *    filesystem for that stage. A COPY source missing from the context fails, as in Docker.
 * 3. RUN steps: the build-relevant commands (cd, npm, npx, node, cp, mkdir, ...) are executed
 *    with absolute paths remapped into the stage's root. OS-level commands (apk, dnf, apt,
 *    curl, ...) are skipped and listed in the output.
 * 4. Runtime check: the final stage's entry point (lambda handler, CMD / ENTRYPOINT, or
 *    `npm start`) is located and its compiled require() graph is walked. Unresolvable
 *    relative or workspace-package requires fail the check; unresolvable third-party
 *    requires are reported as warnings.
 *
 * It does NOT reproduce base images (node/npm versions come from your machine), OS
 * packages, or anything outside the build stage commands above. Use a real `docker build`
 * for those, e.g. when changing base images or system dependencies.
 *
 * Usage: npm run docker:check -- [options] [filter ...]
 *    or: node agents-tools/docker-build-check.js [options] [filter ...]
 *   filter              only check images whose workspace path or tag contains one of these
 *   --list              list discovered images and exit
 *   --jobs <n>          images to check in parallel (default 1)
 *   --work-dir <dir>    where to build (default: <os tmpdir>/hrm-docker-build-check). Must be on
 *                       a filesystem that allows executing binaries, with no node_modules
 *                       directory in any of its ancestors
 *   --npm-cache <dir>   npm cache directory to use for `npm ci`
 *   --ignore-scripts    run npm with --ignore-scripts
 *   --noexec            for a --work-dir on a noexec mount (some sandboxes / CI runners): run
 *                       node_modules/.bin commands and `npx` via `node`. Implies --ignore-scripts
 *   --keep              keep each image's build directory after the check
 *   --no-runtime-check  skip step 4 (only check what `docker build` itself would catch)
 *   --verbose           print the full log of each image
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { builtinModules } = require('module');
const { execFileSync, spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const posix = path.posix;

// ---------------------------------------------------------------------------------------------
// CLI

const parseArgs = argv => {
  const options = {
    filters: [],
    jobs: 1,
    workDir: path.join(os.tmpdir(), 'hrm-docker-build-check'),
    npmCache: undefined,
    ignoreScripts: false,
    keep: false,
    verbose: false,
    runtimeCheck: true,
    list: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };
    if (arg === '--jobs') options.jobs = Math.max(1, parseInt(value(), 10) || 1);
    else if (arg === '--work-dir') options.workDir = path.resolve(value());
    else if (arg === '--npm-cache') options.npmCache = path.resolve(value());
    else if (arg === '--ignore-scripts') options.ignoreScripts = true;
    else if (arg === '--noexec') {
      options.noexec = true;
      options.ignoreScripts = true;
    } else if (arg === '--keep') options.keep = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--no-runtime-check') options.runtimeCheck = false;
    else if (arg === '--list') options.list = true;
    else if (arg === '--help' || arg === '-h') {
      const header = fs
        .readFileSync(__filename, 'utf8')
        .match(/\/\*\*\n \* Quick[\s\S]*?\*\//)[0];
      console.log(header.replace(/^ ?\/?\*+\/? ?/gm, ''));
      process.exit(0);
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else options.filters.push(arg);
  }
  return options;
};

// ---------------------------------------------------------------------------------------------
// Small helpers

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });

/** Split a command line into words, honouring single and double quotes. */
const splitWords = line => {
  const words = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m = re.exec(line);
  while (m) {
    words.push(m[1] ?? m[2] ?? m[3]);
    m = re.exec(line);
  }
  return words;
};

/** Convert a Docker / Go filepath.Match style pattern (with ** support) to a RegExp. */
const globToRegExp = pattern => {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) re += '\\[';
      else {
        re += `[${pattern.slice(i + 1, end).replace(/^!/, '^')}]`;
        i = end;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
};

const hasGlob = s => /[*?[]/.test(s);

/** Substitute $VAR / ${VAR} / ${VAR:-default} using vars; unknown variables are left untouched. */
const substitute = (text, vars) =>
  text.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (whole, a, def, b) => {
      const name = a || b;
      if (Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== '')
        return vars[name];
      if (def !== undefined) return def;
      return whole;
    },
  );

/** Map an absolute in-container path to the stage's fake root. */
const inRoot = (rootfs, p) => path.join(rootfs, p);

/**
 * Sourced by every bash started for RUN steps when --noexec is set (via BASH_ENV, with npm told
 * to use bash for scripts): binaries under node_modules/.bin cannot be executed directly on a
 * noexec mount, so drop them from PATH and run them, and `npx <bin>`, through node instead.
 */
const NOEXEC_BASH_ENV = `
PATH=$(printf %s "$PATH" | tr ':' '\\n' | grep -v '/node_modules/\\.bin$' | paste -sd: -)
__nm_bin() {
  local d="$PWD"
  while :; do
    if [ -e "$d/node_modules/.bin/$1" ]; then readlink -f "$d/node_modules/.bin/$1"; return 0; fi
    [ "$d" = / ] && return 1
    d=$(dirname "$d")
  done
}
command_not_found_handle() {
  local cmd="$1" bin
  shift
  bin=$(__nm_bin "$cmd") || { echo "$cmd: command not found" >&2; return 127; }
  node "$bin" "$@"
}
npx() {
  while [ "\${1#-}" != "$1" ]; do shift; done
  local cmd="$1" bin
  shift
  bin=$(__nm_bin "$cmd") || { echo "npx: $cmd not found in node_modules/.bin" >&2; return 127; }
  node "$bin" "$@"
}
`;

const runShell = (command, { cwd, env, log }) =>
  new Promise(resolve => {
    const child = spawn('bash', ['-c', command], { cwd, env });
    child.stdout.on('data', d => log(d.toString()));
    child.stderr.on('data', d => log(d.toString()));
    child.on('close', code => resolve(code));
    child.on('error', err => {
      log(`${err.message}\n`);
      resolve(1);
    });
  });

// ---------------------------------------------------------------------------------------------
// Image discovery: parse `docker build` invocations from workspace `docker:build` scripts

const parseDockerBuild = (command, workspaceDir) => {
  const builds = [];
  for (const part of command.split(/&&|;/)) {
    const words = splitWords(part.trim());
    const at = words.findIndex((w, i) => w === 'build' && words[i - 1] === 'docker');
    if (at === -1) continue;
    const buildArgs = {};
    let file;
    let tag;
    const positional = [];
    for (let i = at + 1; i < words.length; i += 1) {
      const w = words[i];
      const [flag, inline] =
        w.startsWith('--') && w.includes('=')
          ? [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)]
          : [w, undefined];
      const next = () => {
        if (inline !== undefined) return inline;
        i += 1;
        return words[i];
      };
      if (flag === '-f' || flag === '--file') file = next();
      else if (flag === '-t' || flag === '--tag') tag = next();
      else if (flag === '--build-arg') {
        const kv = next();
        const eq = kv.indexOf('=');
        if (eq === -1) buildArgs[kv] = process.env[kv] ?? '';
        else buildArgs[kv.slice(0, eq)] = kv.slice(eq + 1);
      } else if (
        [
          '--platform',
          '--target',
          '--progress',
          '--network',
          '--label',
          '--secret',
          '--ssh',
          '--cache-from',
          '--iidfile',
        ].includes(flag)
      ) {
        next();
      } else if (w.startsWith('-')) {
        // boolean flags such as --no-cache, --pull, -q
      } else positional.push(w);
    }
    const context = path.resolve(workspaceDir, positional[positional.length - 1] || '.');
    builds.push({
      tag,
      buildArgs,
      context,
      dockerfile: path.resolve(
        workspaceDir,
        file || path.join(path.relative(workspaceDir, context), 'Dockerfile'),
      ),
    });
  }
  return builds;
};

const discoverImages = () => {
  const images = [];
  const packageFiles = git(
    REPO_ROOT,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '*package.json',
  )
    .split('\n')
    .filter(f => f && !f.includes('node_modules/') && f !== 'package.json');
  for (const file of packageFiles) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
    } catch {
      continue;
    }
    const script = pkg.scripts?.['docker:build'];
    if (!script) continue;
    const workspace = path.dirname(file);
    parseDockerBuild(script, path.join(REPO_ROOT, workspace)).forEach(build =>
      images.push({ workspace, ...build }),
    );
  }
  return images.sort((a, b) => a.workspace.localeCompare(b.workspace));
};

// ---------------------------------------------------------------------------------------------
// Build context: what a fresh checkout would send to the Docker daemon

const loadDockerignore = context => {
  const file = path.join(context, '.dockerignore');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const negated = l.startsWith('!');
      const p = posix
        .normalize((negated ? l.slice(1) : l).replace(/^\/+/, ''))
        .replace(/\/+$/, '');
      return { negated, re: globToRegExp(p) };
    });
};

const isIgnored = (relPath, patterns) => {
  const segments = relPath.split('/');
  const candidates = segments.map((_, i) => segments.slice(0, i + 1).join('/'));
  let ignored = false;
  for (const { negated, re } of patterns) {
    if (candidates.some(c => re.test(c))) ignored = !negated;
  }
  return ignored;
};

const loadContext = context => {
  const patterns = loadDockerignore(context);
  const files = git(
    context,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '.',
  )
    .split('\n')
    .filter(Boolean)
    .filter(f => fs.existsSync(path.join(context, f)))
    .filter(f => !isIgnored(f, patterns));
  const fileSet = new Set(files);
  const dirSet = new Set(['']);
  files.forEach(f => {
    let d = posix.dirname(f);
    while (d !== '.' && !dirSet.has(d)) {
      dirSet.add(d);
      d = posix.dirname(d);
    }
  });
  return { root: context, files, fileSet, dirSet };
};

// ---------------------------------------------------------------------------------------------
// Dockerfile parsing

const parseDockerfile = file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const instructions = [];
  let current = '';
  let lineNo = 0;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    if (!current && (/^\s*#/.test(line) || !line.trim())) return;
    if (current && /^\s*#/.test(line)) return; // comment lines inside a continuation
    if (!current) lineNo = i + 1;
    if (/\\\s*$/.test(line)) {
      current += `${line.replace(/\\\s*$/, '')} `;
      return;
    }
    current += line;
    const m = current.trim().match(/^(\S+)\s*(.*)$/s);
    instructions.push({ keyword: m[1].toUpperCase(), args: m[2].trim(), line: lineNo });
    current = '';
  });
  return instructions;
};

/** Parse JSON-array ("exec") or shell form of CMD / ENTRYPOINT / RUN. */
const parseExecForm = args => {
  if (args.startsWith('[')) {
    try {
      return { exec: JSON.parse(args) };
    } catch {
      // fall through to shell form
    }
  }
  return { shell: args };
};

// ---------------------------------------------------------------------------------------------
// Runtime check of the final stage

const findEntryPoints = (stage, image) => {
  const { rootfs } = stage;
  const workdirAbs = inRoot(rootfs, stage.workdir);
  const entries = [];
  const notes = [];
  const fromNodeCommand = (words, cwdAbs) => {
    const at = words.findIndex(w => w === 'node' || w.endsWith('/node'));
    if (at === -1) return;
    const script = words.slice(at + 1).find(w => !w.startsWith('-'));
    if (!script) return;
    const abs = script.startsWith('/')
      ? inRoot(rootfs, script)
      : path.resolve(cwdAbs, script);
    entries.push(abs);
  };
  const fromShellText = (text, cwdAbs) => {
    for (const part of text.split(/&&|;|\n/)) {
      const words = splitWords(part.trim());
      if (words[0] === 'cd' && words[1])
        cwdAbs = words[1].startsWith('/')
          ? inRoot(rootfs, words[1])
          : path.resolve(cwdAbs, words[1]);
      else
        fromNodeCommand(
          words.filter(w => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)),
          cwdAbs,
        );
    }
  };
  const fromWords = words => {
    if (!words || !words.length) return;
    if (
      words.length === 1 &&
      /^[\w-][\w./-]*\.[A-Za-z_$][\w$]*$/.test(words[0]) &&
      !/\.(sh|js|cjs|mjs)$/.test(words[0]) &&
      /lambda/i.test(stage.base || '')
    ) {
      // AWS Lambda base image: CMD ["file.handler"]
      entries.push(
        path.join(workdirAbs, `${words[0].slice(0, words[0].lastIndexOf('.'))}.js`),
      );
      return;
    }
    const npmAt = words.findIndex(w => w === 'npm' || w.endsWith('/npm'));
    if (
      npmAt !== -1 &&
      (words[npmAt + 1] === 'start' || (words[npmAt + 1] === 'run' && words[npmAt + 2]))
    ) {
      const scriptName = words[npmAt + 1] === 'start' ? 'start' : words[npmAt + 2];
      const pkgFile = path.join(workdirAbs, 'package.json');
      const script =
        fs.existsSync(pkgFile) &&
        JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts?.[scriptName];
      if (script) fromShellText(script, workdirAbs);
      else
        notes.push(
          `npm script "${scriptName}" not found in ${stage.workdir}/package.json`,
        );
      return;
    }
    if (words.some(w => w === 'node' || w.endsWith('/node'))) {
      fromNodeCommand(words, workdirAbs);
      return;
    }
    // A shell script entry point: look for `node <file>` inside it
    const scriptWord = words.find(w => /\.sh$/.test(w) || w.startsWith('/'));
    if (scriptWord) {
      const abs = scriptWord.startsWith('/')
        ? inRoot(rootfs, scriptWord)
        : path.resolve(workdirAbs, scriptWord);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile())
        fromShellText(fs.readFileSync(abs, 'utf8'), workdirAbs);
    }
  };
  const toWords = form => (form ? form.exec || ['sh', '-c', form.shell] : undefined);
  const entrypoint = toWords(stage.entrypoint);
  const cmd = toWords(stage.cmd);
  // ENTRYPOINT scripts typically end with `exec "$@"`, so CMD runs too: check both
  fromWords(entrypoint);
  fromWords(cmd);
  if (!entries.length && !entrypoint && !cmd)
    notes.push(
      `no CMD / ENTRYPOINT in the final stage of ${path.relative(
        REPO_ROOT,
        image.dockerfile,
      )}`,
    );
  return { entries: [...new Set(entries)], notes };
};

const workspacePackageNames = (() => {
  let cached;
  return () => {
    if (!cached) {
      cached = new Set();
      git(REPO_ROOT, 'ls-files', '*package.json')
        .split('\n')
        .filter(f => f && f !== 'package.json' && !f.includes('node_modules/'))
        .forEach(f => {
          try {
            cached.add(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')).name);
          } catch {
            // ignore unparsable package.json
          }
        });
    }
    return cached;
  };
})();

const packageNameOf = spec =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

const checkRuntime = (stage, image) => {
  const errors = [];
  const warnings = [];
  const { entries, notes } = findEntryPoints(stage, image);
  notes.forEach(n => warnings.push(`runtime check: ${n}`));
  const display = p => p.split(stage.rootfs).join('');
  const workspaceNames = workspacePackageNames();
  const visited = new Set();
  const queue = [];
  for (const entry of entries) {
    // resolve like `node <file>` does: as given, then with .js / .json, then as a directory
    const resolved = [
      entry,
      `${entry}.js`,
      `${entry}.json`,
      path.join(entry, 'index.js'),
    ].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved)
      errors.push(`entry point ${display(entry)} does not exist in the image`);
    else queue.push(fs.realpathSync(resolved));
  }
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!/\.(c?js)$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const re = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;
    let m = re.exec(source);
    while (m) {
      const spec = m[2];
      m = re.exec(source);
      if (
        spec.startsWith('node:') ||
        builtinModules.includes(spec) ||
        builtinModules.includes(spec.split('/')[0])
      )
        continue;
      let resolved;
      try {
        resolved = require.resolve(spec, { paths: [path.dirname(file)] });
      } catch {
        const isOurs = spec.startsWith('.') || workspaceNames.has(packageNameOf(spec));
        const msg = `${display(file)}: cannot resolve require('${spec}')`;
        if (isOurs) errors.push(msg);
        else warnings.push(`${msg} (third-party; fine if provided by the base image)`);
        continue;
      }
      if (!resolved.startsWith(stage.rootfs)) {
        errors.push(
          `${display(
            file,
          )}: require('${spec}') resolved outside the image (${resolved}); use a --work-dir with no node_modules in its ancestors`,
        );
        continue;
      }
      const real = fs.realpathSync(resolved);
      // follow our own code (relative files and workspace packages), not third-party node_modules
      if (!real.split(path.sep).includes('node_modules')) queue.push(real);
    }
  }
  return { entries, errors, warnings };
};

// ---------------------------------------------------------------------------------------------
// Running one image

/**
 * Base images are not reproduced, but Dockerfiles rely on directories they provide (e.g. `cp ...
 * /var/task/` in a lambda image). Every stage gets the common directories, plus those of the
 * matching known base images below. Add an entry here if a new base image is introduced.
 */
const COMMON_BASE_DIRS = [
  '/tmp',
  '/usr/local/bin',
  '/opt',
  '/etc',
  '/var',
  '/home',
  '/root',
];
const KNOWN_BASE_IMAGE_DIRS = [
  { image: /^public\.ecr\.aws\/lambda\//, dirs: ['/var/task', '/var/runtime'] },
  { image: /^node(:|$)/, dirs: ['/home/node'] },
];

const ALLOWED_RUN_COMMANDS = new Set([
  'cd',
  'npm',
  'npx',
  'node',
  'cp',
  'mkdir',
  'mv',
  'ln',
  'chmod',
  'touch',
  'rsync',
  'echo',
  'true',
  'test',
  '[',
  'tsc',
  // repo shell scripts: paths reach them as arguments, which are remapped like any other
  'sh',
  'bash',
]);

/** Rewrite absolute paths in a shell command so they point into the stage's fake root. */
const remapAbsolutePaths = (command, rootfs) =>
  command.replace(
    /(^|[\s=:'"])\/(?!dev\/)(?=[A-Za-z0-9_.*~-])/g,
    (whole, lead) => `${lead}${rootfs}/`,
  );

const copyInto = (src, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, verbatimSymlinks: true, force: true });
};

/**
 * Copy between stages using hard links where possible: stages live on the same filesystem, and
 * copying node_modules for every `COPY --from` would be slow and use a lot of space.
 */
const linkInto = (src, dest) => {
  const stat = fs.lstatSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(entry =>
      linkInto(path.join(src, entry), path.join(dest, entry)),
    );
  } else if (stat.isSymbolicLink()) {
    fs.rmSync(dest, { force: true });
    fs.symlinkSync(fs.readlinkSync(src), dest);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { force: true });
    try {
      fs.linkSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
    }
  }
};

const checkImage = async (image, options, index) => {
  const out = [];
  const log = s => out.push(s);
  const errors = [];
  const warnings = [];
  const skipped = [];
  const label = image.tag || image.workspace;
  const buildDir = path.join(
    options.workDir,
    `${String(index).padStart(2, '0')}-${label.replace(/[^A-Za-z0-9_.-]/g, '_')}`,
  );
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const context = loadContext(image.context);
  const instructions = parseDockerfile(image.dockerfile);
  const dockerfileRel = path.relative(REPO_ROOT, image.dockerfile);
  log(
    `# ${label}: ${dockerfileRel} (context ${
      path.relative(REPO_ROOT, image.context) || '.'
    })\n`,
  );

  const stages = [];
  let stage;
  const globalArgs = {};

  const resolveContextSources = (src, where) => {
    const normalized =
      posix.normalize(src.replace(/^\.?\/+/, '')).replace(/\/+$/, '') || '.';
    if (normalized === '..' || normalized.startsWith('../')) {
      errors.push(`${where}: COPY source "${src}" is outside the build context`);
      return [];
    }
    if (normalized === '.') return [''];
    if (hasGlob(normalized)) {
      const re = globToRegExp(normalized);
      const matches = [...context.fileSet, ...context.dirSet].filter(
        p => p && re.test(p),
      );
      if (!matches.length)
        errors.push(
          `${where}: COPY source "${src}" matches nothing in the build context`,
        );
      return matches;
    }
    if (context.fileSet.has(normalized) || context.dirSet.has(normalized))
      return [normalized];
    errors.push(
      `${where}: COPY source "${src}" not found in the build context (not in git, or excluded by .dockerignore)`,
    );
    return [];
  };

  const copyFromContext = (rel, destAbs, destIsDir) => {
    const srcAbs = path.join(context.root, rel);
    if (context.fileSet.has(rel)) {
      const target = destIsDir ? path.join(destAbs, posix.basename(rel)) : destAbs;
      copyInto(srcAbs, target);
      return;
    }
    // Directory: Docker copies its contents (only files that are part of the context)
    const prefix = rel ? `${rel}/` : '';
    context.files
      .filter(f => f.startsWith(prefix))
      .forEach(f =>
        copyInto(path.join(context.root, f), path.join(destAbs, f.slice(prefix.length))),
      );
    fs.mkdirSync(destAbs, { recursive: true });
  };

  const runInstruction = async ({ keyword, args, line }) => {
    const where = `${dockerfileRel}:${line}`;
    const vars = stage ? { ...stage.args, ...stage.env } : globalArgs;
    switch (keyword) {
      case 'FROM': {
        const words = splitWords(substitute(args, globalArgs));
        const asAt = words.findIndex(w => w.toUpperCase() === 'AS');
        const name = asAt === -1 ? undefined : words[asAt + 1];
        const base = words.find(w => !w.startsWith('--'));
        const parent = stages.find(s => s.name && s.name === base);
        const rootfs = path.join(
          buildDir,
          `stage-${stages.length}${name ? `-${name}` : ''}`,
        );
        if (parent) linkInto(parent.rootfs, rootfs);
        else {
          const dirs = [
            ...COMMON_BASE_DIRS,
            ...KNOWN_BASE_IMAGE_DIRS.filter(k => k.image.test(base || '')).flatMap(
              k => k.dirs,
            ),
          ];
          dirs.forEach(d => fs.mkdirSync(inRoot(rootfs, d), { recursive: true }));
        }
        stage = {
          name,
          base,
          rootfs,
          workdir: parent?.workdir ?? '/',
          env: { ...(parent?.env ?? {}) },
          args: {},
          cmd: parent?.cmd,
          entrypoint: parent?.entrypoint,
        };
        stages.push(stage);
        return;
      }
      case 'ARG': {
        const [name, ...rest] = args.split('=');
        const def = rest.length
          ? substitute(rest.join('='), vars).replace(/^["']|["']$/g, '')
          : undefined;
        const target = stage ? stage.args : globalArgs;
        if (Object.prototype.hasOwnProperty.call(image.buildArgs, name))
          target[name] = image.buildArgs[name];
        else if (def !== undefined) target[name] = def;
        else if (stage && Object.prototype.hasOwnProperty.call(globalArgs, name))
          target[name] = globalArgs[name];
        else target[name] = '';
        return;
      }
      case 'ENV': {
        if (!stage) return;
        const sub = substitute(args, vars);
        if (
          /^[A-Za-z_][A-Za-z0-9_]*\s/.test(sub) &&
          !/^[A-Za-z_][A-Za-z0-9_]*=/.test(sub)
        ) {
          const [k, ...v] = sub.split(/\s+/);
          stage.env[k] = v.join(' ');
        } else {
          splitWords(sub).forEach(kv => {
            const eq = kv.indexOf('=');
            if (eq > 0) stage.env[kv.slice(0, eq)] = kv.slice(eq + 1);
          });
        }
        return;
      }
      case 'WORKDIR': {
        stage.workdir = posix.resolve(stage.workdir, substitute(args, vars));
        fs.mkdirSync(inRoot(stage.rootfs, stage.workdir), { recursive: true });
        return;
      }
      case 'COPY':
      case 'ADD': {
        const words = splitWords(substitute(args, vars));
        const from = words.find(w => w.startsWith('--from='))?.slice('--from='.length);
        const paths = words.filter(w => !w.startsWith('--'));
        if (paths.length < 2) {
          errors.push(`${where}: could not parse ${keyword} ${args}`);
          return;
        }
        const dest = paths.pop();
        const destAbs = inRoot(stage.rootfs, posix.resolve(stage.workdir, dest));
        const multiple = paths.length > 1 || paths.some(hasGlob);
        const destIsDir =
          dest.endsWith('/') ||
          multiple ||
          (fs.existsSync(destAbs) && fs.statSync(destAbs).isDirectory());
        if (from) {
          const source = stages.find(s => s.name === from) || stages[parseInt(from, 10)];
          if (!source) {
            skipped.push(
              `${where}: COPY --from=${from} (external image, not reproduced)`,
            );
            return;
          }
          for (const p of paths) {
            const srcAbs = inRoot(source.rootfs, posix.resolve('/', p));
            if (!fs.existsSync(srcAbs)) {
              errors.push(
                `${where}: COPY --from=${from} source "${p}" does not exist in stage "${from}"`,
              );
              continue;
            }
            const isDir = fs.statSync(srcAbs).isDirectory();
            linkInto(
              srcAbs,
              isDir || !destIsDir ? destAbs : path.join(destAbs, path.basename(srcAbs)),
            );
          }
          return;
        }
        if (keyword === 'ADD' && paths.some(p => /^https?:\/\//.test(p))) {
          skipped.push(`${where}: ADD from URL`);
          return;
        }
        for (const p of paths) {
          for (const rel of resolveContextSources(p, where))
            copyFromContext(rel, destAbs, destIsDir);
        }
        return;
      }
      case 'RUN': {
        const parsed = parseExecForm(args);
        const command = parsed.exec
          ? parsed.exec.map(w => (/\s/.test(w) ? `'${w}'` : w)).join(' ')
          : parsed.shell;
        const tolerant = /;\s*exit\s+0\s*$|\|\|\s*true\s*$/.test(command);
        const segments = substitute(command, vars)
          .replace(/;\s*exit\s+0\s*$|\|\|\s*true\s*$/, '')
          .split(/&&|;/)
          .map(s => s.trim())
          .filter(Boolean);
        const kept = [];
        for (const segment of segments) {
          const first = segment.split(/\s+/)[0];
          if (ALLOWED_RUN_COMMANDS.has(first))
            kept.push(remapAbsolutePaths(segment, stage.rootfs));
          else
            skipped.push(
              `${where}: ${segment.length > 70 ? `${segment.slice(0, 67)}...` : segment}`,
            );
        }
        if (!kept.length) return;
        const env = {
          ...process.env,
          ...stage.args,
          ...stage.env,
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          ...(options.npmCache ? { npm_config_cache: options.npmCache } : {}),
          ...(options.ignoreScripts ? { npm_config_ignore_scripts: 'true' } : {}),
          ...(options.noexec
            ? { BASH_ENV: options.noexecBashEnv, npm_config_script_shell: 'bash' }
            : {}),
          npm_config_audit: 'false',
          npm_config_fund: 'false',
          npm_config_update_notifier: 'false',
        };
        const cwd = inRoot(stage.rootfs, stage.workdir);
        fs.mkdirSync(cwd, { recursive: true });
        log(`\n$ [${where}] ${kept.join(' && ').split(stage.rootfs).join('')}\n`);
        const code = await runShell(`set -e; ${kept.join(' && ')}`, { cwd, env, log });
        if (code !== 0 && !tolerant)
          errors.push(`${where}: RUN failed with exit code ${code} (see log)`);
        return;
      }
      case 'CMD':
        stage.cmd = parseExecForm(substitute(args, vars));
        return;
      case 'ENTRYPOINT':
        stage.entrypoint = parseExecForm(substitute(args, vars));
        return;
      default:
      // USER, EXPOSE, LABEL, HEALTHCHECK, ... do not affect the filesystem
    }
  };

  for (const instruction of instructions) {
    try {
      await runInstruction(instruction);
    } catch (err) {
      errors.push(`${dockerfileRel}:${instruction.line}: ${err.message}`);
    }
    if (errors.length) break; // like docker, stop at the first failing step
  }

  if (!errors.length && stage && options.runtimeCheck) {
    const runtime = checkRuntime(stage, image);
    errors.push(...runtime.errors);
    warnings.push(...runtime.warnings);
    if (runtime.entries.length)
      log(
        `\nentry points: ${runtime.entries
          .map(e => e.split(stage.rootfs).join(''))
          .join(', ')}\n`,
      );
  }

  if (!options.keep) fs.rmSync(buildDir, { recursive: true, force: true });
  return { image, label, errors, warnings, skipped, log: out.join(''), buildDir };
};

// ---------------------------------------------------------------------------------------------
// Main

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  let images = discoverImages();
  if (options.filters.length) {
    images = images.filter(img =>
      options.filters.some(f => img.workspace.includes(f) || (img.tag || '').includes(f)),
    );
  }
  if (options.list || !images.length) {
    images.forEach(img =>
      console.log(
        `${img.workspace}  ->  ${img.tag || '(untagged)'}  [${path.relative(
          REPO_ROOT,
          img.dockerfile,
        )}]`,
      ),
    );
    if (!images.length) console.log('No images matched.');
    return images.length ? 0 : 1;
  }

  for (
    let d = path.dirname(options.workDir);
    d !== path.dirname(d);
    d = path.dirname(d)
  ) {
    if (fs.existsSync(path.join(d, 'node_modules'))) {
      console.error(
        `--work-dir ${options.workDir} has a node_modules directory in an ancestor (${d}); module resolution would leak outside the simulated image. Choose another --work-dir.`,
      );
      return 2;
    }
  }
  fs.mkdirSync(options.workDir, { recursive: true });
  if (options.noexec) {
    options.noexecBashEnv = path.join(options.workDir, 'noexec-bash-env.sh');
    fs.writeFileSync(options.noexecBashEnv, NOEXEC_BASH_ENV);
  }

  console.log(
    `Checking ${images.length} image build(s) in ${options.workDir} (jobs: ${options.jobs})\n`,
  );
  const results = new Array(images.length);
  let next = 0;
  const worker = async () => {
    while (next < images.length) {
      const i = next;
      next += 1;
      const started = Date.now();
      const result = await checkImage(images[i], options, i);
      result.seconds = Math.round((Date.now() - started) / 1000);
      results[i] = result;
      const status = result.errors.length ? 'FAIL' : 'PASS';
      console.log(
        `${status}  ${result.image.workspace} (${result.label}, ${result.seconds}s)`,
      );
      if (result.errors.length)
        console.log(result.errors.map(e => `        error: ${e}`).join('\n'));
      if (options.verbose || result.errors.length) {
        const tail = options.verbose
          ? result.log
          : result.log.split('\n').slice(-40).join('\n');
        console.log(tail.replace(/^/gm, '        | '));
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.jobs, images.length) }, worker),
  );

  const failed = results.filter(r => r.errors.length);
  const withWarnings = results.filter(r => r.warnings.length);
  if (withWarnings.length) {
    console.log('\nWarnings:');
    withWarnings.forEach(r =>
      r.warnings.forEach(w => console.log(`  ${r.image.workspace}: ${w}`)),
    );
  }
  const skippedSteps = [...new Set(results.flatMap(r => r.skipped))];
  if (skippedSteps.length) {
    console.log('\nNot reproduced (OS-level or external steps):');
    skippedSteps.forEach(s => console.log(`  ${s}`));
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} image build(s) passed${
      failed.length ? `; failed: ${failed.map(r => r.image.workspace).join(', ')}` : ''
    }`,
  );
  if (options.keep) console.log(`Build directories kept under ${options.workDir}`);
  return failed.length ? 1 : 0;
};

main().then(
  code => process.exit(code),
  err => {
    console.error(err);
    process.exit(2);
  },
);
