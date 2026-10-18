import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail, runCli } from './errors.ts';
import { workLayout } from './paths.ts';

export interface TlsMaterial {
  directory: string;
  caCert: string;
  cert: string;
  key: string;
  /** SHA256 of the leaf certificate, lowercase hex. */
  fingerprint: string;
}
export type Openssl = (args: readonly string[]) => void;
const openssl: Openssl = (args) => {
  execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'inherit'] });
};

export const leafFingerprint = (pem: string | Buffer) =>
  new X509Certificate(pem).fingerprint256.replaceAll(':', '').toLowerCase();

/**
 * Job-only CA constrained to DNS:localhost and one localhost leaf. The CA key
 * is deleted at once; nothing is added to any system trust store here.
 */
export async function createJobTls(
  directory: string,
  run: Openssl = openssl,
): Promise<TlsMaterial> {
  await mkdir(directory, { recursive: true });
  const caKey = join(directory, 'ca-key.pem');
  const caCert = join(directory, 'ca-cert.pem');
  const key = join(directory, 'localhost-key.pem');
  const csr = join(directory, 'localhost.csr');
  const cert = join(directory, 'localhost-cert.pem');
  const extension = join(directory, 'leaf.ext');
  try {
    run([
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '1',
      '-subj',
      '/CN=formicarium-showcase-job-ca',
      '-addext',
      'basicConstraints=critical,CA:TRUE,pathlen:0',
      '-addext',
      'keyUsage=critical,keyCertSign',
      '-addext',
      'nameConstraints=critical,permitted;DNS:localhost',
      '-keyout',
      caKey,
      '-out',
      caCert,
    ]);
    await chmod(caKey, 0o600);
    await writeFile(
      extension,
      [
        'subjectAltName=DNS:localhost',
        'basicConstraints=critical,CA:FALSE',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        '',
      ].join('\n'),
    );
    run([
      'req',
      '-new',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-subj',
      '/CN=localhost',
      '-keyout',
      key,
      '-out',
      csr,
    ]);
    await chmod(key, 0o600);
    run([
      'x509',
      '-req',
      '-sha256',
      '-days',
      '1',
      '-in',
      csr,
      '-CA',
      caCert,
      '-CAkey',
      caKey,
      '-CAcreateserial',
      '-extfile',
      extension,
      '-out',
      cert,
    ]);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    return fail(
      'config-invalid',
      'job TLS material could not be created',
      error,
    );
  } finally {
    await rm(caKey, { force: true });
  }
  const leaf = new X509Certificate(await readFile(cert));
  if (leaf.ca || leaf.checkHost('localhost') !== 'localhost')
    fail('config-invalid', 'job leaf certificate is not a localhost leaf');
  return {
    directory,
    caCert,
    cert,
    key,
    fingerprint: leafFingerprint(await readFile(cert)),
  };
}

/** CI passes the material it trusted; the pinned fingerprint must still match. */
export async function tlsFromEnvironment(
  env: NodeJS.ProcessEnv,
): Promise<TlsMaterial | null> {
  const {
    SHOWCASE_TLS_CA,
    SHOWCASE_TLS_CERT,
    SHOWCASE_TLS_KEY,
    SHOWCASE_TLS_SHA256,
  } = env;
  if (!SHOWCASE_TLS_CERT && !SHOWCASE_TLS_KEY && !SHOWCASE_TLS_CA) return null;
  if (
    !SHOWCASE_TLS_CA ||
    !SHOWCASE_TLS_CERT ||
    !SHOWCASE_TLS_KEY ||
    !SHOWCASE_TLS_SHA256
  )
    fail(
      'config-invalid',
      'SHOWCASE_TLS_CA/CERT/KEY/SHA256 must be set together',
    );
  if (
    leafFingerprint(await readFile(SHOWCASE_TLS_CERT)) !== SHOWCASE_TLS_SHA256
  )
    fail(
      'config-invalid',
      'SHOWCASE_TLS_CERT differs from SHOWCASE_TLS_SHA256',
    );
  return {
    directory: '',
    caCert: SHOWCASE_TLS_CA,
    cert: SHOWCASE_TLS_CERT,
    key: SHOWCASE_TLS_KEY,
    fingerprint: SHOWCASE_TLS_SHA256,
  };
}

/** Removes keys and certificates this process created (never CI-provided ones). */
export async function removeJobTls(material: TlsMaterial): Promise<void> {
  if (material.directory)
    await rm(material.directory, { recursive: true, force: true });
}

if (import.meta.main)
  await runCli('job TLS', async () => {
    if (process.argv[2] !== 'create')
      fail('config-invalid', 'usage: tls.ts create');
    const material = await createJobTls(workLayout().tls);
    // Printed for GITHUB_ENV; paths and a public fingerprint only, no key data.
    console.log(
      [
        `SHOWCASE_TLS_CA=${material.caCert}`,
        `SHOWCASE_TLS_CERT=${material.cert}`,
        `SHOWCASE_TLS_KEY=${material.key}`,
        `SHOWCASE_TLS_SHA256=${material.fingerprint}`,
      ].join('\n'),
    );
  });
