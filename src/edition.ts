/**
 * Which app this build is. Two come out of one tree:
 *
 * - 'trans', the app as it has always been (hrt.mahiro.uk): feminizing or
 *   masculinizing HRT, whichever the person picks.
 * - 'cis', for cis women taking estradiol (cishrt.mahiro.uk), built with
 *   `npm run build:cis`. Estradiol only, so no testosterone mode and no
 *   anti-androgens; cis female reference ranges in place of GAHT targets and
 *   menopause HRT dose bands in place of feminizing ones; a cat without the
 *   trans flag; and a health check first, whose estradiol from before HRT is
 *   the person's own and sits under the model's curve (see utils/healthCheck).
 *
 * Fixed at build time (vite.config.ts), so a build is only ever one of them.
 */
export type Edition = 'trans' | 'cis';

export const EDITION: Edition = import.meta.env.VITE_EDITION === 'cis' ? 'cis' : 'trans';

export const IS_CIS = EDITION === 'cis';
