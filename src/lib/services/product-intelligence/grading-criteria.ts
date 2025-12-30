/**
 * Coin Grading Criteria for Claude Vision
 *
 * This module provides specialized grading prompts for different coin types,
 * incorporating official wear point descriptions and grade distinctions from
 * PCGS, NGC, and numismatic reference sources.
 */

export type CoinType =
  | 'morgan-dollar'
  | 'peace-dollar'
  | 'walking-liberty-half'
  | 'saint-gaudens-double-eagle'
  | 'buffalo-nickel'
  | 'mercury-dime'
  | 'lincoln-wheat-cent'
  | 'barber-quarter'
  | 'barber-half'
  | 'barber-dime'
  | 'standing-liberty-quarter'
  | 'franklin-half'
  | 'kennedy-half'
  | 'washington-quarter'
  | 'roosevelt-dime'
  | 'jefferson-nickel'
  | 'indian-head-cent'
  | 'seated-liberty'
  | 'trade-dollar'
  | 'generic-silver'
  | 'generic-gold'
  | 'generic';

export interface WearPoint {
  area: string;
  description: string;
  importance: 'critical' | 'high' | 'medium';
}

export interface GradeDistinction {
  grade: string;
  description: string;
}

export interface CoinGradingCriteria {
  coinType: CoinType;
  displayName: string;
  years?: string;
  obverseWearPoints: WearPoint[];
  reverseWearPoints: WearPoint[];
  gradeDistinctions: GradeDistinction[];
  specialConsiderations?: string[];
  gradingWeight?: string;
}

// ============================================================================
// COIN-SPECIFIC GRADING CRITERIA
// ============================================================================

const MORGAN_DOLLAR_CRITERIA: CoinGradingCriteria = {
  coinType: 'morgan-dollar',
  displayName: 'Morgan Dollar',
  years: '1878-1921',
  obverseWearPoints: [
    {
      area: "Liberty's cheek",
      description:
        'Primary focal point. First to show wear as smoothing and loss of texture. In MS grades, should have full luster with no flattening or marks.',
      importance: 'critical',
    },
    {
      area: 'Hair above ear',
      description:
        'Hair directly above the ear shows wear early. Look for separation of hair strands. AU coins show slight friction here.',
      importance: 'critical',
    },
    {
      area: 'Hair above forehead/eye',
      description:
        'In EF shows slight wear. In VF displays wide flat areas. Hair line should separate from forehead until G grade.',
      importance: 'high',
    },
    {
      area: 'Cotton leaf edges',
      description: 'Flatten with wear. Check for detail in cotton blossoms.',
      importance: 'medium',
    },
    {
      area: 'Cap fold',
      description: 'High upper fold shows trace wear in AU grades.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: "Eagle's breast",
      description:
        'Center of breast shows wear first. In VF, almost all feathers gone. In EF, high points lightly worn.',
      importance: 'critical',
    },
    {
      area: 'Wing edges',
      description: 'Edges near shoulder retain luster longest. Tips wear first.',
      importance: 'high',
    },
    {
      area: 'Leg tops',
      description: 'Show wear in AU and lower grades.',
      importance: 'medium',
    },
    {
      area: "Eagle's talons",
      description: 'Flatten with wear. In AU, slight trace of wear visible.',
      importance: 'medium',
    },
  ],
  gradeDistinctions: [
    {
      grade: 'MS-65+',
      description:
        'Nearly mark-free, especially on cheek and left obverse field. Full cartwheel luster.',
    },
    {
      grade: 'MS-63-64',
      description: 'Some marks visible but none particularly heavy or distracting.',
    },
    {
      grade: 'MS-60-62',
      description: 'Heavily bag-marked but no wear. Full luster present.',
    },
    {
      grade: 'AU-58',
      description: 'Slightest wear on hair above ear and eagle breast. Most luster remains.',
    },
    {
      grade: 'AU-50',
      description: 'Traces of wear on cheek, hair, breast. 3/4 of luster present.',
    },
    {
      grade: 'EF-40',
      description: 'Light wear on hair and cheek. Eagle breast high points lightly worn.',
    },
    { grade: 'VF-20', description: 'Hair above forehead flat. Breast feathers mostly gone.' },
    { grade: 'F-12', description: 'Hair merged with forehead. Eagle outline visible.' },
    { grade: 'G-4', description: 'Liberty outlined. Date and lettering visible.' },
  ],
  gradingWeight: 'Two-thirds of grading weight given to obverse. Cheek and hair are critical.',
  specialConsiderations: [
    'Bag marks on cheek are very common and significantly affect grade',
    'Weak strikes on hair details can mimic wear - check luster to distinguish',
    'The left obverse field is highly prone to contact marks',
  ],
};

const PEACE_DOLLAR_CRITERIA: CoinGradingCriteria = {
  coinType: 'peace-dollar',
  displayName: 'Peace Dollar',
  years: '1921-1935',
  obverseWearPoints: [
    {
      area: 'Hair above forehead',
      description: 'Shows wear first. Look for separation of strands.',
      importance: 'critical',
    },
    {
      area: 'Hair bun',
      description: 'Loose knot at back of head. Should have full luster in MS grades.',
      importance: 'critical',
    },
    {
      area: 'Hair by cheek',
      description: 'High point prone to early wear.',
      importance: 'high',
    },
    {
      area: 'Neckline',
      description: 'Above the date, exposed to early circulation wear.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: 'Eagle wing high point',
      description: 'Top of wing shows wear first.',
      importance: 'critical',
    },
    {
      area: 'Wing meets leg',
      description: 'Key wear checkpoint.',
      importance: 'high',
    },
    {
      area: 'Right shoulder',
      description: 'Top of right shoulder must retain mint luster in MS grades.',
      importance: 'high',
    },
    {
      area: 'Left wing edge',
      description: 'Outer edge should retain texture and fine design lines.',
      importance: 'medium',
    },
  ],
  gradeDistinctions: [
    {
      grade: 'MS-65+',
      description: 'Slight defects only. Well-struck with average or better luster.',
    },
    { grade: 'MS-60-64', description: 'Full luster but may have stains, marks, or abrasions.' },
    { grade: 'AU-55-58', description: 'Slight trace of wear. Most mint luster present.' },
    { grade: 'AU-50', description: 'Some mint luster remains. High points show slight wear.' },
    {
      grade: 'EF-40',
      description: 'Light even wear on highest areas. Silver grey sheen replaces luster.',
    },
    { grade: 'VF-20', description: 'Hairlines over brow worn slightly. Wing feathers visible.' },
    { grade: 'F-12', description: 'Major details heavily worn. Hair and feathers appear flat.' },
    { grade: 'G-4', description: 'Well-worn eagle outline without visible feathers.' },
  ],
  specialConsiderations: [
    '1921 Peace Dollars are HIGH RELIEF - flatness on hairline is NOT wear, must check other areas',
    'Perhaps no other series has so many "almost uncirculated" coins - distinguish weak strike from wear',
    'Look for fine lines or luster breaks as evidence of rub vs strike weakness',
  ],
};

const WALKING_LIBERTY_HALF_CRITERIA: CoinGradingCriteria = {
  coinType: 'walking-liberty-half',
  displayName: 'Walking Liberty Half Dollar',
  years: '1916-1947',
  obverseWearPoints: [
    {
      area: "Liberty's left leg",
      description: 'First sign of wear appears here. Key area for AU grading.',
      importance: 'critical',
    },
    {
      area: "Liberty's left breast",
      description: 'Shows wear early. Should be outlined in VF.',
      importance: 'critical',
    },
    {
      area: "Liberty's left hand",
      description: 'Often weak due to metal flow, not wear - verify with luster.',
      importance: 'high',
    },
    {
      area: 'Hair to forehead separation',
      description: 'Key indicator for EF grade.',
      importance: 'high',
    },
  ],
  reverseWearPoints: [
    {
      area: "Eagle's breast",
      description: 'Feathers flatten with wear. Key reverse checkpoint.',
      importance: 'critical',
    },
    {
      area: "Eagle's left leg",
      description: 'Shows wear in AU and lower grades.',
      importance: 'high',
    },
    {
      area: 'Wing feathers',
      description: 'Upper edges wear first. In VF, many outer feathers blur together.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    {
      grade: 'MS-65+',
      description: 'Full luster, minimal marks. Liberty and eagle nearly mark-free.',
    },
    {
      grade: 'MS-60-64',
      description: 'No wear, full luster. Contact marks common due to high relief.',
    },
    { grade: 'AU-58', description: 'Light wear on left leg and left breast only.' },
    { grade: 'AU-50', description: 'Collar visible. High points worn. Most luster present.' },
    {
      grade: 'VF-35',
      description: 'Left breast almost outlined. Eagle breast/leg have little detail.',
    },
    {
      grade: 'F-15',
      description: "Gap between breasts creates 'hook' appearance. Inner wing feathers clear.",
    },
    { grade: 'F-12', description: 'Stars above arm visible though flattened.' },
  ],
  specialConsiderations: [
    '1920s coins often appear worn despite having full luster',
    'San Francisco coins from 1930s-40s may appear worn when actually uncirculated',
    'High relief design makes Liberty very susceptible to contact marks',
  ],
};

const SAINT_GAUDENS_CRITERIA: CoinGradingCriteria = {
  coinType: 'saint-gaudens-double-eagle',
  displayName: 'Saint-Gaudens Double Eagle',
  years: '1907-1933',
  obverseWearPoints: [
    {
      area: "Liberty's breast",
      description: 'Highest point, shows wear first. Most marks occur here.',
      importance: 'critical',
    },
    {
      area: "Liberty's knee",
      description: 'Key wear point. Should be sharp in AU and above.',
      importance: 'critical',
    },
    {
      area: "Liberty's nose",
      description: 'Trace wear visible in AU grades.',
      importance: 'high',
    },
    {
      area: 'Gown folds',
      description: 'Marks can hide within folds.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: "Eagle's wing",
      description: 'Shows wear in circulated grades.',
      importance: 'critical',
    },
    {
      area: 'Breast feathers',
      description: 'Worn in lower grades.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    {
      grade: 'MS-65+',
      description: 'Minimal marks on breast and knee. Full luster, exceptional eye appeal.',
    },
    { grade: 'MS-63', description: 'Some blemishes in focal areas. Luster may be less prominent.' },
    {
      grade: 'MS-60',
      description: 'Full luster but may look unappealing with heavy marks across surfaces.',
    },
    {
      grade: 'AU-55-58',
      description: "Trace wear on nose, breast, and knee. Eagle's wing shows slight wear.",
    },
    {
      grade: 'EF-40',
      description: "Eagle's left wing and breast feathers worn. Wear below knee visible.",
    },
  ],
  gradingWeight:
    "Marks on date, mintmark, or Liberty's face weigh more heavily than marks in protected areas.",
  specialConsiderations: [
    'Rim bumps and hairlines are common issues',
    'Heavy contact marks in fields from bank handling',
    'Low relief coins (1907-1933 regular issues) were bagged and show more marks',
    '1907 High Relief coins have different grading considerations',
  ],
};

const BUFFALO_NICKEL_CRITERIA: CoinGradingCriteria = {
  coinType: 'buffalo-nickel',
  displayName: 'Buffalo Nickel',
  years: '1913-1938',
  obverseWearPoints: [
    {
      area: "Indian's cheek",
      description:
        'Just under the eye, highest point. Wear shows as color change and smoothing of texture.',
      importance: 'critical',
    },
    {
      area: 'Hair strands',
      description: 'Should remain bold in EF and higher.',
      importance: 'high',
    },
    {
      area: 'Long feather',
      description: 'At back of head, begins to merge with hair in F grade.',
      importance: 'high',
    },
    {
      area: 'Braid detail',
      description: 'Can be weak from strike, not just wear.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: "Buffalo's horn",
      description:
        'CRITICAL indicator. Full horn = VF+. Base only = F. Gone = G or below. BUT: many MS coins lack full horn due to strike!',
      importance: 'critical',
    },
    {
      area: 'Fur details',
      description: 'Head and shoulder fur wear progressively.',
      importance: 'high',
    },
    {
      area: 'Tail',
      description: 'Visibility helps determine grade.',
      importance: 'medium',
    },
  ],
  gradeDistinctions: [
    { grade: 'MS-65+', description: 'Full mint luster. No wear on cheek or any high points.' },
    {
      grade: 'EF-40',
      description: 'Hair strands bold. Most fur details remain. Horn complete with tip.',
    },
    {
      grade: 'VF-20',
      description: 'Hair and cheek show flatness. Partial feather detail. Horn point visible.',
    },
    { grade: 'F-12', description: 'Feather merging with hair. Horn upper half missing but base.' },
    { grade: 'G-4', description: 'Hair, cheek, and feathers blended. Horn completely missing.' },
  ],
  specialConsiderations: [
    'Denver and San Francisco mints 1917-27 often indistinct on high points',
    'Many MINT STATE coins lack fully visible horn due to weak strike',
    'ANA guide now notes "Point of horn not always visible" for VF-20',
    'Must distinguish strike weakness from actual wear using luster',
  ],
};

const MERCURY_DIME_CRITERIA: CoinGradingCriteria = {
  coinType: 'mercury-dime',
  displayName: 'Mercury Dime (Winged Liberty Head)',
  years: '1916-1945',
  obverseWearPoints: [
    {
      area: 'Hair above ear',
      description: "Shows wear first. Critical at every grade level.",
      importance: 'critical',
    },
    {
      area: 'Wing tips',
      description: 'Should be sharp and well-defined in high grades.',
      importance: 'high',
    },
    {
      area: 'Cheek',
      description: 'Shows wear in circulated grades.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: 'Central horizontal bands',
      description:
        'On fasces, these are KEY. High profile means quick wear. Full separation required for FB designation.',
      importance: 'critical',
    },
    {
      area: 'Diagonal bands',
      description: 'Two crossing bands must show for VF/EF. Slight wear only in EF.',
      importance: 'high',
    },
    {
      area: 'Vertical sticks',
      description: 'Clarity confirms strike quality and grade. Half visible = G.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    {
      grade: 'MS-65+FB',
      description:
        'Full Bands: central bands completely separated, no breaks, bridges, or interruptions.',
    },
    { grade: 'MS-65+', description: 'No wear. Strong luster. Minor hairlines acceptable.' },
    {
      grade: 'AU-50-58',
      description: 'Trace wear on hair and wing tips. Bands may be flat from strike.',
    },
    { grade: 'EF-40', description: 'Light wear on hair. Diagonal bands show only slight wear.' },
    { grade: 'VF-20', description: 'Diagonal bands must show. Some flatness acceptable.' },
    { grade: 'F-12', description: 'All sticks defined. Diagonal bands worn nearly flat.' },
    { grade: 'G-4', description: 'One-half of sticks discernible in fasces.' },
  ],
  specialConsiderations: [
    'Full Bands (FB) is premium designation - requires complete separation of central bands',
    'FB generally requires MS-60+; AU-50 allowed for 1916-D, 1942/1, 1942/1-D only',
    'San Francisco and mid-1920s often show weak bands from STRIKE, not wear',
    'Check luster uniformity to distinguish strike weakness from wear',
  ],
};

const LINCOLN_WHEAT_CENT_CRITERIA: CoinGradingCriteria = {
  coinType: 'lincoln-wheat-cent',
  displayName: 'Lincoln Wheat Cent',
  years: '1909-1958',
  obverseWearPoints: [
    {
      area: 'Cheekbone',
      description: 'Shows wear early. Key area for grading.',
      importance: 'critical',
    },
    {
      area: 'Jawline',
      description: 'Jaw and cheek should be separated in F grade and above.',
      importance: 'high',
    },
    {
      area: 'Hair details',
      description: 'Above ear, shows progressive wear. Curls visible in VF.',
      importance: 'high',
    },
    {
      area: 'Ear',
      description: 'About 1/3 present in F-12 grade.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: 'Wheat stalk lines',
      description: 'Primary reverse indicator. Check separation of parallel lines.',
      importance: 'critical',
    },
    {
      area: 'Wheat tips',
      description: 'Show wear in AU grades.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    { grade: 'MS-65+RD', description: 'Full red color (95%+). No wear. Exceptional luster.' },
    {
      grade: 'AU-58',
      description: 'Minimal abrasion on cheekbone and jaw. Wheat tips minimal wear.',
    },
    {
      grade: 'AU-55',
      description: 'Trace wear on highest point of jaw. Wheat stalks trace wear.',
    },
    {
      grade: 'EF-40',
      description: 'Slight wear on hair, cheek, jaw. Wheat lines clearly defined. Half luster.',
    },
    {
      grade: 'VF-20',
      description: 'Hair curls visible. Jaw and cheek smooth but defined. Wheat separation clear.',
    },
    {
      grade: 'F-12',
      description: 'About 2/3 of wheat lines show. Jawline and cheekbone taking shape.',
    },
    { grade: 'VG-8', description: '1/3 of wheat lines show. Hint of jawline and cheekbone.' },
    { grade: 'G-4', description: 'Half of lines in wheat heads. Hair outline only.' },
  ],
  specialConsiderations: [
    'Color designations: RD (95%+ red), RB (5-95% red), BN (less than 5% red)',
    'Original red color commands significant premium',
    'Environmental damage (spots, fingerprints) particularly visible on copper',
  ],
};

// ============================================================================
// GENERIC CRITERIA FOR UNSPECIFIED TYPES
// ============================================================================

const GENERIC_SILVER_CRITERIA: CoinGradingCriteria = {
  coinType: 'generic-silver',
  displayName: 'Generic Silver Coin',
  obverseWearPoints: [
    {
      area: 'Highest relief points',
      description: 'Check all high points of the design for wear or flattening.',
      importance: 'critical',
    },
    {
      area: 'Portrait features',
      description: 'Hair, cheek, and facial features show wear early.',
      importance: 'high',
    },
    {
      area: 'Field areas',
      description: 'Check for bag marks, contact marks, and hairlines.',
      importance: 'medium',
    },
  ],
  reverseWearPoints: [
    {
      area: 'Eagle/main device',
      description: 'Breast, wing edges, and feathers show progressive wear.',
      importance: 'critical',
    },
    {
      area: 'Secondary devices',
      description: 'Shields, wreaths, and other elements.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    { grade: 'MS-65+', description: 'No wear. Minimal marks. Full luster. Excellent eye appeal.' },
    { grade: 'MS-60-64', description: 'No wear. Various degrees of marks and luster.' },
    { grade: 'AU-50-58', description: 'Trace to slight wear on high points. Most luster remains.' },
    { grade: 'EF-40-45', description: 'Light wear on high points. All design details sharp.' },
    { grade: 'VF-20-35', description: 'Moderate wear. Major features clear and sharp.' },
    { grade: 'F-12-15', description: 'Moderate to heavy even wear. All lettering visible.' },
    { grade: 'VG-8-10', description: 'Well worn. Main features clear but flat.' },
    { grade: 'G-4-6', description: 'Heavily worn. Design visible but faint in spots.' },
  ],
};

const GENERIC_GOLD_CRITERIA: CoinGradingCriteria = {
  coinType: 'generic-gold',
  displayName: 'Generic Gold Coin',
  obverseWearPoints: [
    {
      area: 'Highest relief points',
      description: 'Gold is soft - high points show wear quickly.',
      importance: 'critical',
    },
    {
      area: 'Portrait/Liberty features',
      description: 'Hair, breast, knee on Liberty designs.',
      importance: 'high',
    },
    {
      area: 'Fields',
      description: 'Check for contact marks - common from bank handling.',
      importance: 'high',
    },
  ],
  reverseWearPoints: [
    {
      area: 'Eagle',
      description: 'Wing, breast, and leg details.',
      importance: 'critical',
    },
    {
      area: 'Lettering and devices',
      description: 'Should be sharp in higher grades.',
      importance: 'high',
    },
  ],
  gradeDistinctions: [
    { grade: 'MS-65+', description: 'Minimal marks. Full luster. Exceptional eye appeal.' },
    { grade: 'MS-60-64', description: 'No wear but may have contact marks from handling.' },
    { grade: 'AU-50-58', description: 'Trace wear on high points. Strong luster.' },
    { grade: 'EF-40-45', description: 'Light wear. All details sharp.' },
    { grade: 'VF-20-35', description: 'Moderate wear on high points.' },
  ],
  specialConsiderations: [
    'Gold is soft metal - wear appears faster than on other metals',
    'Contact marks from bank bagging are common',
    'Rim issues and hairlines affect grade significantly',
  ],
};

// ============================================================================
// CRITERIA MAP
// ============================================================================

const GRADING_CRITERIA_MAP: Record<CoinType, CoinGradingCriteria> = {
  'morgan-dollar': MORGAN_DOLLAR_CRITERIA,
  'peace-dollar': PEACE_DOLLAR_CRITERIA,
  'walking-liberty-half': WALKING_LIBERTY_HALF_CRITERIA,
  'saint-gaudens-double-eagle': SAINT_GAUDENS_CRITERIA,
  'buffalo-nickel': BUFFALO_NICKEL_CRITERIA,
  'mercury-dime': MERCURY_DIME_CRITERIA,
  'lincoln-wheat-cent': LINCOLN_WHEAT_CENT_CRITERIA,
  // Aliases and generics
  'barber-quarter': GENERIC_SILVER_CRITERIA,
  'barber-half': GENERIC_SILVER_CRITERIA,
  'barber-dime': GENERIC_SILVER_CRITERIA,
  'standing-liberty-quarter': GENERIC_SILVER_CRITERIA,
  'franklin-half': GENERIC_SILVER_CRITERIA,
  'kennedy-half': GENERIC_SILVER_CRITERIA,
  'washington-quarter': GENERIC_SILVER_CRITERIA,
  'roosevelt-dime': GENERIC_SILVER_CRITERIA,
  'jefferson-nickel': GENERIC_SILVER_CRITERIA,
  'indian-head-cent': GENERIC_SILVER_CRITERIA,
  'seated-liberty': GENERIC_SILVER_CRITERIA,
  'trade-dollar': GENERIC_SILVER_CRITERIA,
  'generic-silver': GENERIC_SILVER_CRITERIA,
  'generic-gold': GENERIC_GOLD_CRITERIA,
  generic: GENERIC_SILVER_CRITERIA,
};

// ============================================================================
// PROBLEM DETECTION CRITERIA
// ============================================================================

export interface ProblemIndicator {
  problem: string;
  signs: string[];
  gradingImpact: string;
}

export const PROBLEM_DETECTION_CRITERIA: ProblemIndicator[] = [
  {
    problem: 'Cleaning',
    signs: [
      'Microscopic scratches or hairline marks visible under magnification',
      'Unnatural brightness or color that seems wrong for the age',
      'Breakups in natural luster pattern',
      'Flat or muted details despite apparent high grade',
      'Incuse parallel lines visible when rotating coin under light',
      'Loss of original mint frost',
      'Harsh, bright appearance inconsistent with natural aging',
    ],
    gradingImpact:
      "Cleaned coins receive 'Details' grade from PCGS/NGC, not numeric grade. Value typically 40-70% less than uncleaned equivalent.",
  },
  {
    problem: 'Whizzing',
    signs: [
      "Unnatural 'sheen' instead of true cartwheel luster effect",
      'Light bounces differently with diffused effect',
      'Fine scratches or grooves disrupting original design details',
      'Lettering, hairlines, and stars appear less sharp than expected',
      'Soft or blurred fine details from metal removal',
      'Directional marks inconsistent with minting process',
    ],
    gradingImpact:
      "Labeled as 'Altered Surfaces' or 'Cleaned' - not eligible for numeric grade.",
  },
  {
    problem: 'Tooling',
    signs: [
      'Unnaturally smooth areas in fields where scratches should be visible',
      'Design details that appear re-engraved or overly sharp in localized areas',
      'Evidence of metal movement or displacement',
      'Inconsistent surface texture between different areas',
    ],
    gradingImpact: "Coins labeled 'TOOLED' or 'OBV/REV TOOLED' - details grade only.",
  },
  {
    problem: 'Artificial Toning',
    signs: [
      'Colors inconsistent with natural toning patterns for the metal and age',
      'Toning that appears to hide underlying problems',
      'Unnatural color progression (natural toning progresses from rim inward)',
      'Color concentrated in unusual areas',
      'Overly vibrant or garish colors',
      'Toning that ends abruptly rather than fading naturally',
    ],
    gradingImpact: 'Coins with artificial toning refused numeric grade by major services.',
  },
  {
    problem: 'Environmental Damage',
    signs: [
      'PVC damage - greenish residue from improper plastic storage',
      'Corrosion spots or pitting',
      'Water spots or staining',
      'Fingerprints etched into surface (acidic oils)',
      'Dark spotting or discoloration',
    ],
    gradingImpact: "May receive 'Environmental Damage' details grade.",
  },
  {
    problem: 'Damage/Alterations',
    signs: [
      'Scratches, gouges, or rim dings',
      'Evidence of mounting (solder, bezel marks)',
      'Filled holes from previous jewelry use',
      'Bent or misshapen coin',
      'Edge damage or filing',
    ],
    gradingImpact: 'Details grade with specific problem noted (Scratched, Bent, Mount Removed, etc.).',
  },
];

// ============================================================================
// PROMPT GENERATION FUNCTIONS
// ============================================================================

/**
 * Get grading criteria for a specific coin type
 */
export function getGradingCriteria(coinType: CoinType): CoinGradingCriteria {
  return GRADING_CRITERIA_MAP[coinType] || GRADING_CRITERIA_MAP.generic;
}

/**
 * Detect coin type from identification string
 */
export function detectCoinType(identification: string): CoinType {
  const lower = identification.toLowerCase();

  if (lower.includes('morgan') && lower.includes('dollar')) return 'morgan-dollar';
  if (lower.includes('peace') && lower.includes('dollar')) return 'peace-dollar';
  if (lower.includes('walking liberty') || lower.includes('walker')) return 'walking-liberty-half';
  if (lower.includes('saint gaudens') || lower.includes('saint-gaudens') || lower.includes('$20 gold'))
    return 'saint-gaudens-double-eagle';
  if (lower.includes('buffalo') && lower.includes('nickel')) return 'buffalo-nickel';
  if (lower.includes('mercury') && lower.includes('dime')) return 'mercury-dime';
  if (lower.includes('wheat') && (lower.includes('cent') || lower.includes('penny')))
    return 'lincoln-wheat-cent';
  if (lower.includes('barber') && lower.includes('quarter')) return 'barber-quarter';
  if (lower.includes('barber') && lower.includes('half')) return 'barber-half';
  if (lower.includes('barber') && lower.includes('dime')) return 'barber-dime';
  if (lower.includes('standing liberty')) return 'standing-liberty-quarter';
  if (lower.includes('franklin') && lower.includes('half')) return 'franklin-half';
  if (lower.includes('kennedy')) return 'kennedy-half';
  if (lower.includes('washington') && lower.includes('quarter')) return 'washington-quarter';
  if (lower.includes('roosevelt') && lower.includes('dime')) return 'roosevelt-dime';
  if (lower.includes('jefferson') && lower.includes('nickel')) return 'jefferson-nickel';
  if (lower.includes('indian head') && lower.includes('cent')) return 'indian-head-cent';
  if (lower.includes('seated liberty')) return 'seated-liberty';
  if (lower.includes('trade dollar')) return 'trade-dollar';
  if (lower.includes('gold') || lower.includes('$5') || lower.includes('$10') || lower.includes('$2.5'))
    return 'generic-gold';

  return 'generic';
}

/**
 * Generate a specialized grading prompt for Claude Vision based on coin type
 */
export function generateGradingPrompt(coinType: CoinType): string {
  const criteria = getGradingCriteria(coinType);

  const obversePoints = criteria.obverseWearPoints
    .map((wp) => `  - ${wp.area}: ${wp.description}`)
    .join('\n');

  const reversePoints = criteria.reverseWearPoints
    .map((wp) => `  - ${wp.area}: ${wp.description}`)
    .join('\n');

  const gradeGuide = criteria.gradeDistinctions
    .map((gd) => `  - ${gd.grade}: ${gd.description}`)
    .join('\n');

  const specialNotes = criteria.specialConsiderations
    ? `\nSPECIAL CONSIDERATIONS FOR ${criteria.displayName.toUpperCase()}:\n${criteria.specialConsiderations.map((s) => `- ${s}`).join('\n')}`
    : '';

  const weightNote = criteria.gradingWeight
    ? `\nGRADING WEIGHT: ${criteria.gradingWeight}`
    : '';

  const problemSigns = PROBLEM_DETECTION_CRITERIA.map(
    (p) => `${p.problem}:\n${p.signs.slice(0, 3).map((s) => `    - ${s}`).join('\n')}`
  ).join('\n  ');

  return `You are an expert numismatist specializing in grading ${criteria.displayName} coins using the Sheldon scale.

COIN TYPE: ${criteria.displayName}${criteria.years ? ` (${criteria.years})` : ''}

Analyze the provided coin image(s) carefully. Examine the following specific areas:

OBVERSE WEAR POINTS:
${obversePoints}

REVERSE WEAR POINTS:
${reversePoints}
${specialNotes}
${weightNote}

GRADE DISTINCTIONS FOR THIS TYPE:
${gradeGuide}

PROBLEM DETECTION - Look for signs of:
  ${problemSigns}

GRADING METHODOLOGY:
1. Position your mental "light" at 45 degrees and imagine rotating the coin
2. Check edges and rims first for dents, bumps, or defects
3. Examine wear points in order of importance (critical > high > medium)
4. Compare observed wear to the grade distinctions above
5. Check for any cleaning, whizzing, tooling, or artificial toning
6. Assess overall eye appeal

Provide your assessment as JSON:
{
  "grade": "MS-65" or "AU-58" or "VF-30" etc. (Sheldon scale designation),
  "numericGrade": 65 (numeric only, 1-70),
  "confidence": 0.0 to 1.0 (your confidence in this grade),
  "notes": "Detailed explanation of grade factors observed",
  "surfaces": "Description of surface condition, marks, hairlines",
  "strike": "Assessment of strike quality (weak, average, strong, full)",
  "luster": "Assessment of remaining luster (percentage and quality)",
  "eyeAppeal": "Overall visual impression (below average, average, above average, exceptional)",
  "wearPoints": {
    "obverse": "Specific observations on obverse wear points",
    "reverse": "Specific observations on reverse wear points"
  },
  "problems": [] or ["cleaned", "whizzed", "artificial toning", etc.],
  "detailsGrade": null or "Cleaned" or "Tooled" etc. if problems detected
}`;
}

/**
 * Generate a quick grading prompt without full coin-specific details
 */
export function generateQuickGradingPrompt(): string {
  return `You are an expert numismatist with decades of experience grading coins using the Sheldon scale.

Analyze the provided coin image(s) and estimate the grade. Consider:

SURFACES: Scratches, hairlines, cleaning evidence, environmental damage, contact marks, bag marks
LUSTER: Original mint luster presence, cartwheel effect, toning quality
STRIKE: Sharpness of details, weakness in high points, design definition
WEAR: Examine all high points of the design for flattening or smoothing
EYE APPEAL: Overall visual impression and aesthetic quality

PROBLEM DETECTION - Check for:
- Cleaning: unnatural brightness, hairlines, stripped luster
- Whizzing: wire-brush marks, unnatural sheen, blurred details
- Tooling: re-engraved details, smoothed fields
- Artificial toning: unnatural colors, abrupt color transitions

Provide your assessment as JSON:
{
  "grade": "MS-65" or "AU-58" etc. (Sheldon scale designation),
  "numericGrade": 65 (numeric only),
  "confidence": 0.0 to 1.0,
  "notes": "Detailed explanation of grade factors",
  "surfaces": "Description of surface condition",
  "strike": "Assessment of strike quality",
  "luster": "Assessment of remaining luster",
  "problems": [] or ["cleaned", "whizzed", etc.],
  "detailsGrade": null or "Cleaned" etc. if problems detected
}`;
}

/**
 * Generate grading prompt with automatic coin type detection
 */
export function generateAdaptiveGradingPrompt(identification: string): string {
  const coinType = detectCoinType(identification);
  return generateGradingPrompt(coinType);
}

// ============================================================================
// REFERENCE IMAGE SOURCES
// ============================================================================

export interface ReferenceImageSource {
  name: string;
  url: string;
  description: string;
  coverage: string;
  accessType: 'free' | 'subscription' | 'included-with-submission';
}

export const REFERENCE_IMAGE_SOURCES: ReferenceImageSource[] = [
  {
    name: 'PCGS Photograde Online',
    url: 'https://www.pcgs.com/photograde',
    description:
      'Official PCGS reference with 2,580 high-resolution coin photographs covering 86 popular series in approximately 23 grades each.',
    coverage: 'Poor-1 through MS-69 for most series',
    accessType: 'free',
  },
  {
    name: 'PCGS TrueView',
    url: 'https://www.pcgs.com/trueview',
    description:
      'High-quality 500x500 pixel photographs of certified coins. Available for coins submitted to PCGS.',
    coverage: 'All PCGS-graded coins',
    accessType: 'included-with-submission',
  },
  {
    name: 'PCGS CoinFacts',
    url: 'https://www.pcgs.com/coinfacts',
    description:
      'Comprehensive database with images, population data, auction prices, and variety information.',
    coverage: 'All US coins with historical pricing',
    accessType: 'subscription',
  },
  {
    name: 'NGC Coin Explorer',
    url: 'https://www.ngccoin.com/coin-explorer/',
    description:
      'NGC database with images of certified coins, census data, and auction prices realized.',
    coverage: 'All NGC-graded coins',
    accessType: 'free',
  },
  {
    name: 'NGC Photo Vision',
    url: 'https://www.ngccoin.com/submit/services-fees/photo-vision/',
    description: 'High-resolution imaging service for NGC-submitted coins.',
    coverage: 'NGC submissions',
    accessType: 'included-with-submission',
  },
  {
    name: 'Heritage Auctions Archives',
    url: 'https://coins.ha.com/',
    description:
      'Massive archive of auction lot images with realized prices. Excellent for seeing coins at various grades.',
    coverage: 'Millions of lots dating back decades',
    accessType: 'free',
  },
  {
    name: 'CoinStudy.com',
    url: 'https://www.coinstudy.com/',
    description: 'Free grading guides with comparison images for major US coin types.',
    coverage: 'Major US series with grade comparisons',
    accessType: 'free',
  },
  {
    name: 'USA Coin Book',
    url: 'https://www.usacoinbook.com/',
    description: 'Coin images, values, and grading information for US coins.',
    coverage: 'All US coins',
    accessType: 'free',
  },
  {
    name: 'CoinAuctionsHelp.com',
    url: 'https://coinauctionshelp.com/',
    description: 'Detailed grading guides with comparison photos for popular series.',
    coverage: 'Morgan, Peace, Walking Liberty, and other popular series',
    accessType: 'free',
  },
  {
    name: 'ANA Money Museum',
    url: 'https://www.money.org/',
    description: 'American Numismatic Association reference materials and grading set images.',
    coverage: 'Official ANA grading standards',
    accessType: 'free',
  },
];

/**
 * Get reference image sources for a specific coin type
 */
export function getReferenceSourcesForCoinType(coinType: CoinType): ReferenceImageSource[] {
  // All sources are generally applicable, but we could filter by coin type if needed
  return REFERENCE_IMAGE_SOURCES;
}
