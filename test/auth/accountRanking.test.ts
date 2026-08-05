import { describe, expect, test } from 'vitest';
import {
  getAccountPageRanking,
  getAccountPageMatchScore,
  rankAccountsForPage
} from '../../src/lib/auth/accountRanking';
import { SITE_IDENTITY_OVERRIDES } from '../../src/lib/auth/accountSiteMetadata';
import type { AuthenticatorAccount } from '../../src/lib/auth/types';

describe('contextual account ranking', () => {
  test('puts an issuer matching the current site first', () => {
    const accounts = [account('GitHub'), account('Instagram'), account('Example')];
    const ranking = getAccountPageRanking(accounts, { hostname: 'www.instagram.com' });

    expect(labels(ranking.accounts)).toEqual([
      'Instagram',
      'GitHub',
      'Example'
    ]);
    expect(ranking.suggestedAccountIds).toEqual(new Set([accounts[1].id]));
  });

  test('matches compact names, punctuation, diacritics, and public suffixes', () => {
    const accounts = [account('Example'), account('Bank of America'), account('Digital Océan')];

    expect(
      labels(rankAccountsForPage(accounts, { hostname: 'secure.bank-of-america.co.uk' }))
    ).toEqual(['Bank of America', 'Example', 'Digital Océan']);
    expect(
      labels(rankAccountsForPage(accounts, { hostname: 'login.digital-ocean.com' }))
    ).toEqual(['Digital Océan', 'Example', 'Bank of America']);
  });

  test('supports historical and shared-brand aliases in both directions', () => {
    const twitter = account('Twitter');
    const x = account('X');
    const openAi = account('OpenAI');

    expect(rankAccountsForPage([openAi, twitter], { hostname: 'x.com' })[0]).toBe(twitter);
    expect(rankAccountsForPage([openAi, x], { hostname: 'twitter.com' })[0]).toBe(x);
    expect(rankAccountsForPage([twitter, openAi], { hostname: 'chatgpt.com' })[0]).toBe(openAi);
  });

  test('covers popular rebrands, shared accounts, and domain-name mismatches', () => {
    const cases = [
      ['icloud.com', 'Apple ID'],
      ['accounts.firefox.com', 'Mozilla Account'],
      ['ubisoft.com', 'Uplay'],
      ['tutanota.com', 'Tuta'],
      ['goto.com', 'LogMeIn'],
      ['gmail.com', 'Google'],
      ['fitbit.com', 'Google'],
      ['office.com', 'Microsoft'],
      ['threads.com', 'Instagram'],
      ['trello.com', 'Atlassian'],
      ['behance.net', 'Adobe ID'],
      ['audible.com', 'Amazon'],
      ['quickbooks.com', 'Intuit'],
      ['claude.ai', 'Anthropic'],
      ['steampowered.com', 'Steam'],
      ['valorant.com', 'Riot Games'],
      ['npmjs.com', 'npm'],
      ['duosecurity.com', 'Cisco Duo'],
      ['keepersecurity.com', 'Keeper'],
      ['mi.com', 'Xiaomi'],
      ['wikipedia.org', 'Wikimedia']
    ] as const;

    for (const [hostname, issuer] of cases) {
      expect(
        getAccountPageMatchScore(account(issuer), { hostname }),
        `${issuer} should match ${hostname}`
      ).toBeGreaterThan(0);
    }
  });

  test('keeps sibling products isolated when only their account provider is shared', () => {
    expect(getAccountPageMatchScore(account('YouTube'), { hostname: 'gmail.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Bitbucket'), { hostname: 'trello.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('TurboTax'), { hostname: 'quickbooks.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Instagram'), { hostname: 'facebook.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Meta'), { hostname: 'instagram.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Dropbox'), { hostname: 'hellosign.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Cisco'), { hostname: 'duosecurity.com' })).toBe(0);
    expect(getAccountPageMatchScore(account('Microsoft'), { hostname: 'github.com' })).toBe(0);
  });

  test('keeps override metadata normalized and free of duplicate domains', () => {
    const domains = SITE_IDENTITY_OVERRIDES.flatMap((entry) => [...entry.domains]);

    expect(new Set(domains).size).toBe(domains.length);
    for (const entry of SITE_IDENTITY_OVERRIDES) {
      expect(entry.domains.length).toBeGreaterThan(0);
      expect(entry.names.length).toBeGreaterThan(0);
      for (const domain of entry.domains) {
        expect(domain).toBe(domain.toLowerCase());
        expect(domain).toMatch(/^[a-z0-9.-]+$/);
        expect(domain).not.toMatch(/^\.|\.$/);
      }
    }
  });

  test('lets specific overrides replace a generic parent brand', () => {
    const other = account('Example');
    const amazon = account('Amazon');
    const aws = account('Amazon Web Services');

    expect(
      rankAccountsForPage([other, amazon, aws], { hostname: 'signin.aws.amazon.com' })
    ).toEqual([aws, other, amazon]);
    expect(getAccountPageMatchScore(amazon, { hostname: 'signin.aws.amazon.com' })).toBe(0);
  });

  test('uses a label when the issuer is missing or generic', () => {
    const blankIssuer = account('', 'Instagram · alice');
    const genericIssuer = account('2FA', 'Instagram backup');
    const other = account('GitHub');

    expect(rankAccountsForPage([other, blankIssuer], { hostname: 'instagram.com' })[0]).toBe(blankIssuer);
    expect(rankAccountsForPage([other, genericIssuer], { hostname: 'instagram.com' })[0]).toBe(genericIssuer);
  });

  test('can use a non-email label as a weaker secondary signal', () => {
    const labeled = account('Personal vault', 'Instagram alice');
    const other = account('GitHub');

    expect(rankAccountsForPage([other, labeled], { hostname: 'instagram.com' })[0]).toBe(labeled);
  });

  test('weights issuer, fallback label, and secondary label matches predictably', () => {
    const issuerMatch = account('Instagram', 'alice');
    const fallbackLabelMatch = account('', 'Instagram bob');
    const secondaryLabelMatch = account('Personal vault', 'Instagram carol');
    const context = { hostname: 'instagram.com' };

    expect(getAccountPageMatchScore(issuerMatch, context)).toBeGreaterThan(
      getAccountPageMatchScore(fallbackLabelMatch, context)
    );
    expect(getAccountPageMatchScore(fallbackLabelMatch, context)).toBeGreaterThan(
      getAccountPageMatchScore(secondaryLabelMatch, context)
    );
  });

  test('does not trust lookalike domains or page titles on unrelated domains', () => {
    const accounts = [account('GitHub'), account('Instagram')];
    const instagram = accounts[1];

    expect(
      getAccountPageMatchScore(instagram, {
        hostname: 'instagram-login.example.com',
        title: 'Instagram – Sign in'
      })
    ).toBe(0);
    expect(getAccountPageMatchScore(instagram, { hostname: 'instagram.com.evil.test' })).toBe(0);
    expect(
      labels(
        rankAccountsForPage(accounts, {
          hostname: 'example.com',
          title: 'Instagram – Sign in'
        })
      )
    ).toEqual(['GitHub', 'Instagram']);
  });

  test('ignores account email domains as service names', () => {
    const github = account('GitHub', 'alice@instagram.com');
    const example = account('Example');

    expect(rankAccountsForPage([github, example], { hostname: 'instagram.com' })).toEqual([
      github,
      example
    ]);
  });

  test('uses an email domain only when no useful issuer is available', () => {
    const blankIssuer = account('', 'alice@instagram.com');
    const other = account('GitHub');

    expect(rankAccountsForPage([other, blankIssuer], { hostname: 'instagram.com' })[0]).toBe(blankIssuer);
  });

  test('does not infer brands from privately controlled hosting subdomains', () => {
    const accounts = [account('GitHub'), account('Instagram')];

    expect(rankAccountsForPage(accounts, { hostname: 'instagram.github.io' })).toEqual(accounts);
    expect(
      rankAccountsForPage([account('Shopify'), account('Vercel')], {
        hostname: 'shop.example.myshopify.com'
      }).map((item) => item.issuer)
    ).toEqual(['Shopify', 'Vercel']);
    expect(getAccountPageMatchScore(account('Cloudflare'), { hostname: 'project.pages.dev' })).toBe(0);
    expect(getAccountPageMatchScore(account('Vercel'), { hostname: 'project.vercel.app' })).toBe(0);
  });

  test('supports exact local and IP service labels', () => {
    const local = account('localhost');
    const router = account('192.168.1.1');
    const other = account('Example');

    expect(rankAccountsForPage([other, local], { hostname: 'localhost' })[0]).toBe(local);
    expect(rankAccountsForPage([other, router], { hostname: '192.168.1.1' })[0]).toBe(router);
  });

  test('avoids incidental short-domain matches while supporting exact dotted brands', () => {
    const appleId = account('Apple ID');
    const idMe = account('ID.me');
    const creativeAi = account('Creative AI tools');
    const ai = account('AI');

    expect(getAccountPageMatchScore(appleId, { hostname: 'id.me' })).toBe(0);
    expect(getAccountPageMatchScore(idMe, { hostname: 'id.me' })).toBeGreaterThan(0);
    expect(getAccountPageMatchScore(creativeAi, { hostname: 'ai.com' })).toBe(0);
    expect(getAccountPageMatchScore(ai, { hostname: 'ai.com' })).toBeGreaterThan(0);
  });

  test('requires short and noise-heavy aliases to match the full account name', () => {
    expect(getAccountPageMatchScore(account('Mi'), { hostname: 'mi.com' })).toBeGreaterThan(0);
    expect(getAccountPageMatchScore(account('Mi Banco'), { hostname: 'mi.com' })).toBe(0);
    expect(
      getAccountPageMatchScore(account('Login.gov'), { hostname: 'login.gov' })
    ).toBeGreaterThan(0);
    expect(getAccountPageMatchScore(account('Gov.uk'), { hostname: 'login.gov' })).toBe(0);
  });

  test('does not guess an expanded issuer from a generic domain acronym', () => {
    expect(getAccountPageMatchScore(account('ABC'), { hostname: 'abc.com' })).toBeGreaterThan(0);
    expect(getAccountPageMatchScore(account('Apple Business Connect'), { hostname: 'abc.com' })).toBe(0);
  });

  test('keeps intentional parent identities on more-specific overrides', () => {
    expect(getAccountPageMatchScore(account('Azure'), { hostname: 'dev.azure.com' })).toBeGreaterThan(0);
    expect(
      getAccountPageMatchScore(account('Visual Studio'), { hostname: 'visualstudio.com' })
    ).toBeGreaterThan(0);
    expect(getAccountPageMatchScore(account('Live'), { hostname: 'onedrive.live.com' })).toBeGreaterThan(0);
  });

  test('uses titles only to reinforce an existing hostname match', () => {
    const instagram = account('Instagram');
    const withoutTitle = getAccountPageMatchScore(instagram, { hostname: 'instagram.com' });
    const withTitle = getAccountPageMatchScore(instagram, {
      hostname: 'instagram.com',
      title: 'Sign in to Instagram'
    });

    expect(withTitle).toBeGreaterThan(withoutTitle);
  });

  test('retains manual order for equal matches and all unmatched accounts', () => {
    const firstInstagram = account('Instagram', 'alice');
    const github = account('GitHub');
    const secondInstagram = account('Instagram', 'bob');
    const example = account('Example');

    expect(
      rankAccountsForPage([github, firstInstagram, example, secondInstagram], {
        hostname: 'instagram.com'
      })
    ).toEqual([firstInstagram, secondInstagram, github, example]);
  });

  test('falls back safely and never mutates the incoming account array', () => {
    const accounts = [account('GitHub'), account('Instagram')];
    const snapshot = [...accounts];

    expect(rankAccountsForPage(accounts, null)).toEqual(snapshot);
    expect(getAccountPageRanking(accounts, null).suggestedAccountIds.size).toBe(0);
    expect(rankAccountsForPage(accounts, { hostname: 'not a hostname' })).toEqual(snapshot);
    expect(rankAccountsForPage(accounts, { hostname: 'chrome://extensions' })).toEqual(snapshot);
    expect(accounts).toEqual(snapshot);
  });
});

function account(issuer: string, label = issuer): AuthenticatorAccount {
  return {
    id: crypto.randomUUID(),
    issuer,
    label,
    secret: 'JBSWY3DPEHPK3PXP',
    type: 'totp',
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
    counter: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function labels(accounts: AuthenticatorAccount[]): string[] {
  return accounts.map((item) => item.issuer || item.label);
}
