// Boundary violation fixture: a relative import of a runtime internal.
import { failure } from '../../runtime/errors.ts';

export const probe = failure;
