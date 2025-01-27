import { isVersionReleased, MatchRelease } from "@/lib/version";

describe('isVersionReleased', () => {
  const tagPrefix = 'myprefix@';

  test('returns true for a published release with matching tag prefix', () => {
    const release: MatchRelease = {
      tag_name: `${tagPrefix}1.0.0`,
      name: 'Release 1.0.0',
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(true);
  });

  test('returns false for a prerelease', () => {
    const release = {
      tag_name: `${tagPrefix}1.0.0-rc.1`,
      name: 'Release 1.0.0-rc.1',
      prerelease: true,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(false);
  });

  test('returns false for a draft release', () => {
    const release = {
      tag_name: `${tagPrefix}1.0.0`,
      name: 'Release 1.0.0',
      prerelease: false,
      draft: true
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(false);
  });

  test('returns false for non-matching tag prefix', () => {
    const release = {
      tag_name: 'other-prefix@1.0.0',
      name: 'Release 1.0.0',
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(false);
  });

  test('returns false when release has no name but version prefix is specified', () => {
    const versionPrefix = 'beta-';
    const release = {
      tag_name: `${tagPrefix}1.0.0`,
      name: undefined,
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, versionPrefix)).toBe(false);
  });

  test('returns true for release with matching tag prefix and no version prefix restriction', () => {
    const release = {
      tag_name: `${tagPrefix}1.0.0`,
      name: 'beta-Release 1.0.0', // name doesn't matter when versionPrefix is undefined
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(true);
  });

  test('returns true for release with no name and no version prefix restriction', () => {
    const release = {
      tag_name: `${tagPrefix}1.0.0`,
      name: undefined,
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, tagPrefix, undefined)).toBe(true);
  });

  test('returns true for release with name prefixed with v', () => {
    const release = {
      tag_name: `1.0.0`,
      name: 'v1.0.0',
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, '', 'v')).toBe(true);
  });

  test('returns false for release with name not prefixed with v when v prefix is required', () => {
    const release = {
      tag_name: `1.0.0`,
      name: '1.0.0',
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, '', 'v')).toBe(false);
  });

  test('returns true for release with name exactly matching v prefix', () => {
    const release = {
      tag_name: `1.0.0`,
      name: 'v',
      prerelease: false,
      draft: false
    };

    expect(isVersionReleased(release, '', 'v')).toBe(true);
  });
});
