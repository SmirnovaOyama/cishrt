import { Ester, GEL_SITE_ORDER, GNRH_AGONISTS } from '../../logic';
import { IS_CIS } from '../edition';

// The anti-androgens and GnRH agonists are feminizing HRT's, there to lower
// testosterone; a cis woman's estradiol therapy has no use for them. Her
// progestogen (medroxyprogesterone) and raloxifene stay.
const NOT_FOR_CIS: ReadonlySet<Ester> = new Set<Ester>([Ester.CPA, Ester.SPIRO, Ester.BICA, ...GNRH_AGONISTS]);

/** The drugs a list offers in this edition: all of them, or in the cis edition the ones above left out. */
export const forEdition = (esters: Ester[]): Ester[] => (IS_CIS ? esters.filter(e => !NOT_FOR_CIS.has(e)) : esters);

/**
 * The gel sites a picker offers, as indices into GEL_SITE_ORDER, which is
 * what a dose stores. Scrotal application is a trans woman's, so the cis
 * edition offers only arm and thigh.
 */
export const GEL_SITE_INDICES: number[] = GEL_SITE_ORDER.map((_, i) => i).filter(
    i => !IS_CIS || GEL_SITE_ORDER[i] !== 'scrotal',
);
