import diyaImg from '../assets/images/profile_diya_1794732072722.jpg';
import kabirImg from '../assets/images/profile_kabir_1794732073399.jpg';
import meeraImg from '../assets/images/profile_meera_1794732074338.jpg';
import rohanImg from '../assets/images/profile_rohan_1794732074441.jpg';
import ananyaImg from '../assets/images/profile_ananya_1794732075325.jpg';
import type { Gender, ReportReason } from '../types/models';

import { VOLUMETRIC_LIMITS } from './limits';

export { VOLUMETRIC_LIMITS };

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const DOB_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

export const CONNECTION_GOALS = [
  'Long-term partner',
  'Intentional dating',
  'Taking it slow',
  'Still exploring',
] as const;

export const STORY_SPARK_PROMPTS: string[] = [
  'My ideal Sunday morning looks like',
  'A local neighborhood spot I keep coming back to',
  'Two truths and a gentle confession',
  'The fastest way to make me laugh is',
  'Something I am quietly excited about this year',
  'Green flags I always notice right away',
];

export const VERIFICATION_DOC_OPTIONS = [
  { value: 'national_id', label: 'National ID / Aadhaar' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
] as const;

export const INTEREST_OPTIONS: string[] = [
  'Specialty Coffee',
  'Indie Cinema',
  'Coastal Walks',
  'Art Galleries',
  'Vinyl Records',
  'Street Food',
  'Trail Running',
  'Ceramics',
  'Bookstores',
  'Architecture',
  'Live Jazz',
  'Home Cooking',
  'Photography',
  'Cycling',
  'Board Games',
  'Botanical Gardens',
];

export const REPORT_REASON_OPTIONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'harassment', label: 'Harassment or abusive behavior', hint: 'Unwanted pressure, insults, or threats' },
  { value: 'fake_profile', label: 'Impersonation or fake profile', hint: 'Misleading photos or catfishing' },
  { value: 'inappropriate_content', label: 'Inappropriate content', hint: 'Explicit or unsafe bio/photos' },
  { value: 'spam', label: 'Spam or solicitation', hint: 'Promotional links or financial scams' },
  { value: 'underage', label: 'Appears under 18', hint: 'Profile does not meet the 18+ age floor' },
  { value: 'other', label: 'Other safety concern', hint: 'Any other boundary violation' },
];

export interface CityPreset {
  label: string;
  city: string;
  lat: number;
  lng: number;
}

export const CITY_PRESETS: CityPreset[] = [
  { label: 'Bandra West, Mumbai', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  { label: 'Lower Parel, Mumbai', city: 'Mumbai', lat: 18.9977, lng: 72.8305 },
  { label: 'Colaba, Mumbai', city: 'Mumbai', lat: 18.9067, lng: 72.8147 },
  { label: 'Indiranagar, Bengaluru', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  { label: 'Hauz Khas, New Delhi', city: 'New Delhi', lat: 28.5494, lng: 77.2001 },
];

export const PORTRAIT_PRESETS: { id: string; label: string; url: string }[] = [
  { id: 'portrait_diya', label: 'Warm Café Portrait', url: diyaImg },
  { id: 'portrait_kabir', label: 'Golden Hour Terrace', url: kabirImg },
  { id: 'portrait_meera', label: 'Gallery Sunlight', url: meeraImg },
  { id: 'portrait_rohan', label: 'Studio Courtyard', url: rohanImg },
  { id: 'portrait_ananya', label: 'Promenade Daylight', url: ananyaImg },
];

export const DEMO_IMAGES = {
  diya: diyaImg,
  kabir: kabirImg,
  meera: meeraImg,
  rohan: rohanImg,
  ananya: ananyaImg,
};
