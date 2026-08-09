import { parse } from 'tldts';
import { SITE_IDENTITY_OVERRIDES } from './accountSiteMetadata';
import type { AuthenticatorAccount } from './types';

export interface PageContext {
  hostname?: string;
  title?: string;
}

interface NameProfile {
  exact: Set<string>;
  whole: Set<string>;
  tokens: Set<string>;
  phrases: string[];
}

interface PageIdentity {
  siteKey: string;
  exactSiteKeys: Set<string>;
  aliases: Set<string>;
  title: string;
  titleTokens: Set<string>;
}

interface MatchWeights {
  whole: number;
  token: number;
  aliasWhole: number;
  aliasToken: number;
}

export interface AccountPageRanking {
  accounts: AuthenticatorAccount[];
  suggestedAccountIds: ReadonlySet<string>;
}

export interface AccountListView {
  /** Accounts rendered above the reveal control. */
  accounts: AuthenticatorAccount[];
  /** Accounts rendered below the reveal control once every code is revealed. */
  revealedAccounts: AuthenticatorAccount[];
  /** How many accounts the reveal control adds to the list. */
  hiddenCount: number;
  contextualAction: 'showAll' | 'showMatches' | null;
}

const NAME_NOISE = new Set([
  '2fa',
  'account',
  'accounts',
  'auth',
  'authentication',
  'authenticator',
  'co',
  'com',
  'code',
  'codes',
  'default',
  'dev',
  'io',
  'login',
  'net',
  'org',
  'otp',
  'security',
  'signin',
  'totp',
  'verification',
  'verify',
  'website'
]);

const GENERIC_ISSUERS = new Set([
  '',
  '2fa',
  'authenticator',
  'default',
  'other',
  'otp',
  'personal',
  'security',
  'totp',
  'work'
]);

const ISSUER_WEIGHTS: MatchWeights = {
  whole: 120,
  token: 105,
  aliasWhole: 130,
  aliasToken: 115
};

const PRIMARY_LABEL_WEIGHTS: MatchWeights = {
  whole: 100,
  token: 85,
  aliasWhole: 110,
  aliasToken: 95
};

const SECONDARY_LABEL_WEIGHTS: MatchWeights = {
  whole: 75,
  token: 65,
  aliasWhole: 80,
  aliasToken: 70
};

const MIN_MATCH_SCORE = 60;
const MIN_PARTIAL_ALIAS_LENGTH = 3;

const ALIAS_PROFILES = SITE_IDENTITY_OVERRIDES.map((entry) => ({
  domains: entry.domains,
  names: new Set(entry.names.map(compact))
}));

/**
 * Returns a new array with likely matches for the current page first. Equal
 * and unmatched accounts retain their incoming (normally manual) order.
 */
export function rankAccountsForPage(
  accounts: readonly AuthenticatorAccount[],
  context: PageContext | null
): AuthenticatorAccount[] {
  return getAccountPageRanking(accounts, context).accounts;
}

export function getAccountPageRanking(
  accounts: readonly AuthenticatorAccount[],
  context: PageContext | null
): AccountPageRanking {
  const page = getPageIdentity(context);
  if (!page) {
    return { accounts: [...accounts], suggestedAccountIds: new Set() };
  }

  const scoredAccounts = accounts.map((account, index) => ({
    account,
    index,
    score: scoreAccount(account, page)
  }));

  return {
    accounts: scoredAccounts
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map(({ account }) => account),
    suggestedAccountIds: new Set(
      scoredAccounts.filter(({ score }) => score > 0).map(({ account }) => account.id)
    )
  };
}

export function getAccountListView(
  accounts: readonly AuthenticatorAccount[],
  suggestedAccountIds: ReadonlySet<string>,
  options: { query: string; alwaysShowAll: boolean; revealAll: boolean }
): AccountListView {
  const needle = options.query.trim().toLowerCase();
  if (needle) {
    return flatListView(
      accounts.filter(
        (account) =>
          account.label.toLowerCase().includes(needle) ||
          account.issuer.toLowerCase().includes(needle)
      )
    );
  }

  // Preferring the full list drops the grouping altogether, so there is
  // nothing left to reveal or collapse.
  if (options.alwaysShowAll) {
    return flatListView([...accounts]);
  }

  if (suggestedAccountIds.size > 0) {
    const suggestedAccounts = accounts.filter((account) => suggestedAccountIds.has(account.id));
    const otherAccounts = accounts.filter((account) => !suggestedAccountIds.has(account.id));
    if (suggestedAccounts.length > 0 && otherAccounts.length > 0) {
      return {
        accounts: suggestedAccounts,
        revealedAccounts: options.revealAll ? otherAccounts : [],
        hiddenCount: otherAccounts.length,
        contextualAction: options.revealAll ? 'showMatches' : 'showAll'
      };
    }
  }

  return flatListView([...accounts]);
}

function flatListView(accounts: AuthenticatorAccount[]): AccountListView {
  return { accounts, revealedAccounts: [], hiddenCount: 0, contextualAction: null };
}

export function getAccountPageMatchScore(
  account: AuthenticatorAccount,
  context: PageContext | null
): number {
  const page = getPageIdentity(context);
  return page ? scoreAccount(account, page) : 0;
}

function scoreAccount(account: AuthenticatorAccount, page: PageIdentity): number {
  const issuer = createNameProfile(account.issuer);
  const issuerIsGeneric = GENERIC_ISSUERS.has([...issuer.whole][0] ?? '');
  const label = createNameProfile(
    issuerIsGeneric ? account.label : removeEmailAddresses(account.label)
  );
  const primary = issuerIsGeneric ? label : issuer;
  const secondary = issuerIsGeneric ? emptyNameProfile() : label;

  const primaryScore = issuerIsGeneric
    ? scoreNameProfile(primary, page, PRIMARY_LABEL_WEIGHTS)
    : scoreNameProfile(primary, page, ISSUER_WEIGHTS);
  const secondaryScore = scoreNameProfile(secondary, page, SECONDARY_LABEL_WEIGHTS);
  let score = Math.max(primaryScore, secondaryScore);

  // A page title can increase confidence, but cannot promote an account on an
  // unrelated or lookalike domain by itself.
  if (score >= MIN_MATCH_SCORE) {
    const matchedProfile = primaryScore >= secondaryScore ? primary : secondary;
    if (matchedProfile.phrases.some((phrase) => includesPhrase(page.title, phrase))) {
      score += 5;
    } else if ([...matchedProfile.tokens].some((token) => page.titleTokens.has(token))) {
      score += 3;
    }
  }

  return score >= MIN_MATCH_SCORE ? score : 0;
}

function scoreNameProfile(
  profile: NameProfile,
  page: PageIdentity,
  weights: MatchWeights
): number {
  let score = 0;
  if (
    intersects(profile.exact, page.exactSiteKeys) ||
    intersects(profile.whole, page.exactSiteKeys)
  ) {
    score = weights.whole;
  } else if (
    page.siteKey.length >= 3 &&
    profile.tokens.has(page.siteKey)
  ) {
    score = weights.token;
  }

  if (intersects(profile.exact, page.aliases) || intersects(profile.whole, page.aliases)) {
    score = Math.max(score, weights.aliasWhole);
  } else if (
    [...profile.tokens].some(
      (value) => value.length >= MIN_PARTIAL_ALIAS_LENGTH && page.aliases.has(value)
    )
  ) {
    score = Math.max(score, weights.aliasToken);
  }
  return score;
}

function getPageIdentity(context: PageContext | null): PageIdentity | null {
  if (!context?.hostname) {
    return null;
  }
  const hostname = context.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) {
    return null;
  }
  const aliases = getAliasProfile(hostname);
  const parsed = parse(hostname, {
    allowPrivateDomains: true,
    detectSpecialUse: true,
    extractHostname: false
  });
  if (!parsed.hostname) {
    return null;
  }
  // Private suffix tenants are controlled independently of the apparent
  // parent brand. Only an explicit override may opt one back in.
  if (parsed.isPrivate && aliases.size === 0) {
    return null;
  }

  // An explicit override replaces the generic parent-domain identity. On an
  // AWS sign-in host, for example, an Amazon shopping code is not a match.
  const siteKey = aliases.size
    ? ''
    : compact(
        parsed.domainWithoutSuffix ??
          (parsed.isIp || !hostname.includes('.') ? hostname : '')
      );
  if (!siteKey && aliases.size === 0) {
    return null;
  }
  const title = normalizeWords(context.title ?? '');

  return {
    siteKey,
    exactSiteKeys: new Set(
      aliases.size === 0
        ? [siteKey, compact(parsed.domain ?? '')].filter(Boolean)
        : []
    ),
    aliases,
    title,
    titleTokens: new Set(title.split(' ').filter(isMeaningfulToken))
  };
}

function getAliasProfile(hostname: string): Set<string> {
  const matches = ALIAS_PROFILES.flatMap(({ domains, names }) => {
    const domain = domains
      .filter((candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`))
      .sort((left, right) => right.length - left.length)[0];
    return domain ? [{ domain, names }] : [];
  });
  const mostSpecificLength = Math.max(0, ...matches.map(({ domain }) => domain.length));
  return new Set(
    matches
      .filter(({ domain }) => domain.length === mostSpecificLength)
      .flatMap(({ names }) => [...names])
  );
}

function createNameProfile(value: string): NameProfile {
  const phrase = normalizeWords(value);
  if (!phrase) {
    return emptyNameProfile();
  }

  const allTokens = phrase.split(' ');
  const wholeTokens = allTokens.filter((token) => !NAME_NOISE.has(token));
  const tokens = wholeTokens.filter(isMeaningfulToken);

  return {
    exact: new Set([allTokens.join('')]),
    whole: new Set(wholeTokens.length > 0 ? [wholeTokens.join('')] : []),
    tokens: new Set(tokens),
    phrases: [phrase]
  };
}

function emptyNameProfile(): NameProfile {
  return {
    exact: new Set(),
    whole: new Set(),
    tokens: new Set(),
    phrases: []
  };
}

function normalizeWords(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function removeEmailAddresses(value: string): string {
  return value.replace(/\S+@\S+/gu, ' ');
}

function compact(value: string): string {
  return normalizeWords(value).replace(/ /g, '');
}

function isMeaningfulToken(token: string): boolean {
  return token.length >= 2 && !NAME_NOISE.has(token);
}

function includesPhrase(text: string, phrase: string): boolean {
  return Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  return [...left].some((value) => right.has(value));
}
