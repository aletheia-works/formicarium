// Biome probe: a package-internal path instead of a public export.
import { createInstaller } from '@aletheia-works/formicarium/runtime/install.js';

export const probe = createInstaller;
