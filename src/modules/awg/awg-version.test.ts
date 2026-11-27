/**
 * Ported from samur005/3s-ui wgserver/version_test.go (GPL-3.0).
 * Combined Remnawave X work is AGPL-3.0-only.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    AWG_VERSIONS,
    awgFields,
    fillMissingObfuscation,
    generateObfuscation,
    isValidAwgVersion,
    IAwgObfuscation,
    obfuscationEquals,
    pruneObfuscation,
    validateObfuscation,
} from './awg-version';

describe('awg version (3s-ui wgserver/version.go)', () => {
    it('every version generates a valid set', () => {
        for (const version of AWG_VERSIONS) {
            for (let i = 0; i < 50; i++) {
                const obfuscation = generateObfuscation(version);
                const error = validateObfuscation(obfuscation, version);
                assert.equal(error, null);
                assert.equal(
                    obfuscationEquals(obfuscation, pruneObfuscation(obfuscation, version)),
                    true,
                );
            }
        }
    });

    it('fields per version', () => {
        const cases: Array<[string, boolean, boolean, boolean, boolean, boolean]> = [
            ['1.0', false, false, false, false, false],
            ['1.5', true, false, false, false, false],
            ['2.0', true, true, true, false, false],
            ['2.5', true, true, true, false, false],
            ['3.0', true, true, false, true, false],
            ['3.1', true, true, false, true, true],
        ];
        for (const [version, cps, s34, hRange, protection, trailers] of cases) {
            assert.deepEqual(awgFields(version), {
                base: true,
                cps,
                s34,
                hRange,
                protection,
                trailersCookie: trailers,
            });
        }
    });

    it('generated headers are ranges only where allowed', () => {
        assert.match(generateObfuscation('2.0').h1, /-/);
        for (const version of ['1.0', '1.5', '3.0', '3.1']) {
            assert.doesNotMatch(generateObfuscation(version).h1, /-/);
        }
        const generated = generateObfuscation('3.0');
        for (const size of [generated.s1, generated.s2, generated.s3, generated.s4]) {
            assert.ok(size >= 12);
        }
        assert.notEqual(generated.headerProtectionKey, '');
    });

    it('fillMissing keeps what is there and completes the rest', () => {
        const original = generateObfuscation('2.0');
        original.s3 = 0;
        original.s4 = 0;
        original.i1 = '';
        const upgraded = fillMissingObfuscation(original, '3.1');
        assert.notEqual(upgraded.headerProtectionKey, '');
        assert.ok(upgraded.s3 >= 12);
        assert.ok(upgraded.s4 >= 12);
        assert.notEqual(upgraded.contentPaddingAddition, '');
        assert.doesNotMatch(upgraded.h1, /-/);
        assert.equal(validateObfuscation(upgraded, '3.1'), null);

        const downgraded = fillMissingObfuscation(upgraded, '1.0');
        assert.equal(downgraded.s3, 0);
        assert.equal(downgraded.headerProtectionKey, '');
        assert.equal(downgraded.i1, '');
        assert.equal(downgraded.randomTrailers, false);
        assert.equal(validateObfuscation(downgraded, '1.0'), null);
    });

    it('validate refuses bad sets', () => {
        const good = generateObfuscation('3.1');
        const cases: Record<string, (obfuscation: IAwgObfuscation) => void> = {
            'S1+56=S2': (obfuscation) => {
                obfuscation.s1 = 20;
                obfuscation.s2 = 76;
            },
            'H overlap': (obfuscation) => {
                obfuscation.h1 = '100';
                obfuscation.h2 = '100';
            },
            'H not a number': (obfuscation) => {
                obfuscation.h1 = 'abc';
            },
            'negative count': (obfuscation) => {
                obfuscation.i1 = '<r -5>';
            },
            'kernel only tag': (obfuscation) => {
                obfuscation.i1 = '<c>';
            },
            'unknown tag': (obfuscation) => {
                obfuscation.i1 = '<zz 1>';
            },
            unterminated: (obfuscation) => {
                obfuscation.i1 = '<r 5';
            },
            'newline in I': (obfuscation) => {
                obfuscation.i2 = '<r 5>\nPostUp=x';
            },
            'hpk with small S': (obfuscation) => {
                obfuscation.s1 = 5;
            },
            'bad hpk': (obfuscation) => {
                obfuscation.headerProtectionKey = 'short';
            },
            'jmin>jmax': (obfuscation) => {
                obfuscation.jmin = 200;
                obfuscation.jmax = 100;
            },
            'S4 too big': (obfuscation) => {
                obfuscation.s4 = 40;
            },
            'rekey >= reject': (obfuscation) => {
                obfuscation.rekeyAfterTime = '100-200';
                obfuscation.rejectAfterTime = '150-250';
            },
            'timer zero': (obfuscation) => {
                obfuscation.rekeyTimeout = '0';
            },
            'range reversed': (obfuscation) => {
                obfuscation.contentPaddingAddition = '20-10';
            },
        };
        for (const [name, mutate] of Object.entries(cases)) {
            const obfuscation = { ...good };
            mutate(obfuscation);
            assert.notEqual(validateObfuscation(obfuscation, '3.1'), null, name);
        }

        const rangeOn15 = generateObfuscation('1.5');
        rangeOn15.h1 = '100-200';
        assert.notEqual(validateObfuscation(rangeOn15, '1.5'), null);
        assert.equal(validateObfuscation(generateObfuscation('2.0'), '2.0'), null);
    });

    it('versions', () => {
        for (const version of ['1.5', '2.0', '2.5', '3.0', '3.1']) {
            assert.equal(isValidAwgVersion(version), true);
        }
        assert.equal(isValidAwgVersion('4.0'), false);
        assert.equal(isValidAwgVersion(''), false);
    });
});
