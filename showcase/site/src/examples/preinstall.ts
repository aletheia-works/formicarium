// The embedding guide shows this file as it is; the build type-checks it
// against the types of the candidate's pack.
import {
  type CommandSession,
  createCommandSession,
  createInstaller,
  type GuestCatalog,
  type Session,
} from '@aletheia-works/formicarium';

/**
 * Installs `tools` before the user types anything, without writing to the
 * terminal, then returns the command session for the terminal. Each tool runs
 * by name there, and other guests find it as `/usr/bin/<tool>` (for example a
 * version control tool that opens an editor).
 */
export async function terminalWithTools(
  session: Session,
  catalog: GuestCatalog,
  tools: readonly string[],
): Promise<CommandSession> {
  const installer = createInstaller(session, catalog);
  for (const tool of tools) await installer.install(tool);
  return createCommandSession(session, { catalog });
}
