# Copyright (C) 2021-2023 Technology Matters
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see https://www.gnu.org/licenses/.

# Usage: copy-ancestor-dirs.sh <from_root> <start_dir> <to_root> <name>...
#
# Walks from <start_dir> (relative to <from_root>) up to <from_root> itself. In each folder,
# every <name> that exists there (e.g. `packages`, `tsconfig.json`) is copied to the same
# relative location under <to_root>.
#
# Prints the folders of the npm workspaces found in the copied `packages` directories
# (one per line, relative to <from_root>), for use as `npm ci -w` arguments.
#
# Entries are always copied into their parent folder, so running this again over an
# existing <to_root> overwrites rather than nests (no packages/packages).

set -eu

from_root=$1
dir=$2
to_root=$3
shift 3

while :; do
  for name in "$@"; do
    if [ -e "$from_root/$dir/$name" ]; then
      mkdir -p "$to_root/$dir"
      cp -r "$from_root/$dir/$name" "$to_root/$dir/"
      if [ "$name" = packages ]; then
        for workspace in "$from_root/$dir/packages"/*/; do
          if [ -f "$workspace/package.json" ]; then
            workspace=${workspace%/}
            workspace=${workspace#"$from_root"/}
            echo "${workspace#./}"
          fi
        done
      fi
    fi
  done
  if [ "$dir" = . ]; then
    break
  fi
  dir=$(dirname "$dir")
done
