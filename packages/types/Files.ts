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

// These maps are kinda temp hacks until we refactor the hrm permission system.
// They allow us to map an s3 method and file type to the hrm permission name.
export const fileTypes = {
  recording: 'Recording',
  transcript: 'ExternalTranscript',
  document: 'Case',
} as const;

export type FileTypes = keyof typeof fileTypes;

export const fileMethods = {
  getObject: 'view',
  putObject: 'create',
  deleteObject: 'delete',
} as const;

export type FileMethods = keyof typeof fileMethods;
