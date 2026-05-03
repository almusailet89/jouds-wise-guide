export type Lang = 'ar' | 'en';

// ─── All UI strings ──────────────────────────────────────────────────────────
const strings: Record<Lang, Record<string, string>> = {
  ar: {
    // Nav
    'nav.home':      'الرئيسية',
    'nav.chat':      'جود AI',
    'nav.financial': 'المالية',
    'nav.planning':  'تخطيطي',
    'nav.mood':      'المزاج',
    'nav.settings':  'الإعدادات',

    // Header
    'header.tagline':   'مساعدتك الشخصية الذكية',
    'header.majlis':    'المجلس',
    'header.export':    'تصدير',
    'header.logout':    'خروج',
    'header.darkMode':  'الوضع الداكن',
    'header.lightMode': 'الوضع الفاتح',

    // Chat / Voice tab
    'chat.mode.chat':    'محادثة',
    'chat.mode.voice':   'صوتي',
    'chat.majlis.full':  'المجلس الكامل',

    // Tab headings
    'tab.planning': 'تخطيطي',
    'tab.mood':     'تتبع المزاج والصحة',
    'tab.settings': 'الإعدادات والذكاء',

    // Export dialog
    'export.title': 'تصدير البيانات',

    // Gender nudge banner
    'nudge.gender':   '✨ أخبر جود بجنسك حتى تخاطبك بالصيغة الصحيحة',
    'nudge.complete': 'إكمال الملف',

    // Profile dialog
    'profile.title':            'ملفك الشخصي',
    'profile.tab.profile':      'الملف الشخصي',
    'profile.tab.account':      'إعدادات الحساب',
    'profile.avatar':           'الرمز التعبيري',
    'profile.name':             'الاسم',
    'profile.gender':           'الجنس',
    'profile.gender.hint':      '(تحتاجه جود لمخاطبتك بالصيغة الصحيحة)',
    'profile.gender.male':      '👨 ذكر',
    'profile.gender.female':    '👩 أنثى',
    'profile.gender.jood.male':   'جود ستخاطبك بصيغة المذكر (افعل، استخدم، أخبرني…)',
    'profile.gender.jood.female': 'جود ستخاطبك بصيغة المؤنث (افعلي، استخدمي، أخبريني…)',
    'profile.phone':            'رقم الجوال',
    'profile.dob':              'تاريخ الميلاد',
    'profile.city':             'المدينة',
    'profile.city.placeholder': 'اختر مدينتك…',
    'profile.city.other':       'مدينة أخرى',
    'profile.bio':              'نبذة عنك',
    'profile.bio.hint':         '(اختياري — تساعد جود على فهمك أفضل)',
    'profile.bio.placeholder':  'مثلاً: معلمة، أهتم بالتوفير والاستثمار…',
    'profile.language':         'لغة التطبيق',
    'profile.lang.ar':          'العربية',
    'profile.lang.en':          'English',
    'profile.currency':         'العملة المفضلة',
    'profile.save':             'حفظ الملف الشخصي',
    'profile.saving':           'جارٍ الحفظ…',
    'profile.optional':         '(اختياري)',
    'profile.required':         '*',
    'profile.jood.gender':      'جود تخاطبك بصيغة',
    'profile.jood.male.label':  'ذكر',
    'profile.jood.female.label':'أنثى',

    // Account tab
    'account.email':           'البريد الإلكتروني',
    'account.email.readonly':  'لا يمكن تغيير البريد الإلكتروني حالياً',
    'account.password':        'تغيير كلمة المرور',
    'account.password.new':    'كلمة المرور الجديدة',
    'account.password.confirm':'تأكيد كلمة المرور',
    'account.password.save':   'تغيير كلمة المرور',
    'account.password.saving': 'جارٍ التغيير…',
    'account.joined':          'تاريخ الانضمام',
    'account.id':              'معرّف الحساب',

    // Toasts
    'toast.name.required':     'الاسم مطلوب',
    'toast.gender.required':   'يرجى تحديد الجنس حتى تتمكن جود من مخاطبتك بشكل صحيح',
    'toast.save.error':        'تعذّر حفظ البيانات',
    'toast.save.success':      'تم حفظ الملف الشخصي ✓',
    'toast.password.short':    'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    'toast.password.mismatch': 'كلمتا المرور غير متطابقتين',
    'toast.password.error':    'تعذّر تغيير كلمة المرور',
    'toast.password.success':  'تم تغيير كلمة المرور بنجاح ✓',
  },

  en: {
    // Nav
    'nav.home':      'Home',
    'nav.chat':      'Jood AI',
    'nav.financial': 'Finance',
    'nav.planning':  'Planning',
    'nav.mood':      'Mood',
    'nav.settings':  'Settings',

    // Header
    'header.tagline':   'Your smart personal assistant',
    'header.majlis':    'Majlis',
    'header.export':    'Export',
    'header.logout':    'Logout',
    'header.darkMode':  'Dark mode',
    'header.lightMode': 'Light mode',

    // Chat / Voice tab
    'chat.mode.chat':   'Chat',
    'chat.mode.voice':  'Voice',
    'chat.majlis.full': 'Full Majlis',

    // Tab headings
    'tab.planning': 'My Planning',
    'tab.mood':     'Mood & Health Tracker',
    'tab.settings': 'Settings & AI',

    // Export dialog
    'export.title': 'Export Data',

    // Gender nudge banner
    'nudge.gender':   '✨ Tell Jood your gender so she can address you correctly',
    'nudge.complete': 'Complete Profile',

    // Profile dialog
    'profile.title':            'Your Profile',
    'profile.tab.profile':      'Profile',
    'profile.tab.account':      'Account Settings',
    'profile.avatar':           'Avatar',
    'profile.name':             'Name',
    'profile.gender':           'Gender',
    'profile.gender.hint':      '(Jood needs this to address you correctly)',
    'profile.gender.male':      '👨 Male',
    'profile.gender.female':    '👩 Female',
    'profile.gender.jood.male':   'Jood will address you as male (do, use, tell me…)',
    'profile.gender.jood.female': 'Jood will address you as female (do, use, tell me…)',
    'profile.phone':            'Phone Number',
    'profile.dob':              'Date of Birth',
    'profile.city':             'City',
    'profile.city.placeholder': 'Choose your city…',
    'profile.city.other':       'Other city',
    'profile.bio':              'About You',
    'profile.bio.hint':         '(Optional — helps Jood understand you better)',
    'profile.bio.placeholder':  'e.g. Teacher, interested in saving and investing…',
    'profile.language':         'App Language',
    'profile.lang.ar':          'العربية',
    'profile.lang.en':          'English',
    'profile.currency':         'Preferred Currency',
    'profile.save':             'Save Profile',
    'profile.saving':           'Saving…',
    'profile.optional':         '(Optional)',
    'profile.required':         '*',
    'profile.jood.gender':      'Jood addresses you as',
    'profile.jood.male.label':  'Male',
    'profile.jood.female.label':'Female',

    // Account tab
    'account.email':           'Email Address',
    'account.email.readonly':  'Email cannot be changed',
    'account.password':        'Change Password',
    'account.password.new':    'New Password',
    'account.password.confirm':'Confirm Password',
    'account.password.save':   'Change Password',
    'account.password.saving': 'Changing…',
    'account.joined':          'Member Since',
    'account.id':              'Account ID',

    // Toasts
    'toast.name.required':     'Name is required',
    'toast.gender.required':   'Please set your gender so Jood can address you correctly',
    'toast.save.error':        'Could not save profile',
    'toast.save.success':      'Profile saved ✓',
    'toast.password.short':    'Password must be at least 6 characters',
    'toast.password.mismatch': 'Passwords do not match',
    'toast.password.error':    'Could not change password',
    'toast.password.success':  'Password changed successfully ✓',
  },
};

/** Translate a key for the given language, falling back to Arabic, then the key itself. */
export function translate(lang: Lang, key: string): string {
  return strings[lang]?.[key] ?? strings['ar']?.[key] ?? key;
}

export default strings;
