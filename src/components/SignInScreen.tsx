  { href: '#safety', label: 'Trust & Safety' },
  { href: '#preview', label: 'App Preview' },
] as const;

export function SignInScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithSocial,
    authError,
    clearAuthError,
  } = useAuth();
  const { openCookiePreferences } = useCookieConsent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headerRef = useRef<HTMLElement | null>(null);
  const heroCard = DEMO_PROFILES[0];
  const secondaryCards = [DEMO_PROFILES[1], DEMO_PROFILES[2]];
