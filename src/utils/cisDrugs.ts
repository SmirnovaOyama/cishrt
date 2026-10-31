import { Ester, GEL_SITE_ORDER, GNRH_AGONISTS } from '../../logic';
import { IS_CIS } from '../edition';

// The anti-androgens and GnRH agonists are feminizing HRT's, there to lower
// testosterone; a cis woman's estradiol therapy has no use for them. Her
// progestogens and raloxifene stay.
const NOT_FOR_CIS: ReadonlySet<Ester> = new Set<Ester>([Ester.CPA, Ester.SPIRO, Ester.BICA, ...GNRH_AGONISTS]);

// The menopause progestogens only the cis edition lists; the trans edition's
// menus stay as they were.
const CIS_ONLY: ReadonlySet<Ester> = new Set<Ester>([Ester.P4, Ester.DYD]);

/** The drugs a list offers in this edition: each edition leaves out the other's own. */
export const forEdition = (esters: Ester[]): Ester[] =>
    esters.filter(e => (IS_CIS ? !NOT_FOR_CIS.has(e) : !CIS_ONLY.has(e)));

/**
 * The gel sites a picker offers, as indices into GEL_SITE_ORDER, which is
 * what a dose stores. Scrotal application is a trans woman's, so the cis
 * edition offers only arm and thigh.
 */
export const GEL_SITE_INDICES: number[] = GEL_SITE_ORDER.map((_, i) => i).filter(
    i => !IS_CIS || GEL_SITE_ORDER[i] !== 'scrotal',
);
