// The exact statement a link signature must carry (POST /api/account/link).
// Shared by the server check and the client that asks the wallet to sign, so
// a sign-in signature can never be replayed as a link: the statement names
// the account the wallet is being linked to.
export function linkStatement(account: string): string {
  return `Link this wallet to the Raid Shooter account ${account.toLowerCase()}`;
}
