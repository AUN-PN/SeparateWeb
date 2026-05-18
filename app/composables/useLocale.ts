type LocaleCode = 'th' | 'en'

const messages = {
  th: {
    nav: {
      home: 'หน้าหลัก',
      login: 'Login',
      language: 'ภาษา'
    },
    home: {
      metaDescription: 'จับภาพ UI เว็บไซต์และ export cards, icons, layers เป็น PNG assets.',
      title: 'Extract_',
      intro: 'workspace สำหรับเปลี่ยนเว็บไซต์จริงให้เป็น PNG layers, surfaces และ metadata ที่ agent หรือ designer ตรวจต่อได้',
      start: 'เริ่มใช้งาน',
      workspace: 'เปิด Workspace',
      signals: ['ตั้งค่า 5 นาที', 'PNG layers', 'มี metadata', 'ไม่ใช้ mock assets'],
      proofEyebrow: 'หลักฐาน website-to-layer',
      proofTitle: 'หนึ่ง URL กลายเป็นไฟล์ assets พร้อมตรวจ',
      stats: ['Assets ที่ export', 'UI blocks', 'Card surfaces', 'Broken layers'],
      selectedLayer: 'Layer ที่เลือก',
      kind: 'ชนิด',
      bounds: 'ขอบเขต',
      export: 'Export',
      use: 'ใช้ทำ',
      featureEyebrow: 'ระบบแยก UI ครบชุด',
      featureTitle: 'ทุกอย่างที่ต้องใช้เพื่อ automate การจับ assets จากเว็บไซต์',
      workflowEyebrow: 'Extraction layer',
      workflowTitle: 'เชื่อม live webpage ให้กลายเป็น output ที่นำกลับมาใช้ได้',
      capabilities: [
        {
          title: 'จับภาพหน้าเว็บ',
          detail: 'render URL จริง เก็บ context ทั้งหน้า และคงภาพต้นฉบับไว้เป็นหลักฐาน'
        },
        {
          title: 'แยกพื้นผิว UI',
          detail: 'ตรวจจับ cards, layout regions, foreground content และภาพ surface ที่ reuse ได้'
        },
        {
          title: 'ตรวจ metadata',
          detail: 'เก็บ selectors, classes, bounds, kind และ depth คู่กับรูปที่ export'
        },
        {
          title: 'ดู output เป็นหมวด',
          detail: 'กรอง cards, buttons, icons, fields, navigation, media, layout และ content ใน workspace เดียว'
        },
        {
          title: 'Export PNG layers',
          detail: 'สร้าง transparent layers และ clean card surfaces พร้อมใช้กับ design หรือ agent workflows'
        },
        {
          title: 'ทำซ้ำตาม project',
          detail: 'บันทึก URLs ใน project, rerun extraction และเทียบ output โดยไม่ต้องตั้งค่าใหม่'
        }
      ],
      outputAssets: [
        {
          title: 'ภาพต้นฉบับ',
          description: 'ภาพ render ทั้งหน้า เก็บไว้เป็นหลักฐานก่อนแยก layer',
          kind: 'source capture',
          useCase: 'ตรวจ visual parity'
        },
        {
          title: 'Screen surface',
          description: 'พื้นผิวหน้าที่ล้าง foreground noise ออกแล้ว',
          kind: 'background layer',
          useCase: 'สร้าง layout shell ใหม่'
        },
        {
          title: 'Info layer',
          description: 'พื้นที่ content ที่ตรวจพบ พร้อมเก็บ text และ UI context',
          kind: 'content layer',
          useCase: 'ตรวจ selectors'
        },
        {
          title: 'Card surface',
          description: 'พื้นผิว card ที่แยกออกมา reuse ได้',
          kind: 'card surface',
          useCase: 'ส่งต่อ design'
        }
      ],
      architectureNodes: ['URL capture', 'DOM + visual pass', 'Layer classifier', 'PNG exporter', 'Metadata index']
    },
    login: {
      title: 'Login | SeparateWeb',
      eyebrow: 'Login',
      heading: 'เข้าสู่ workspace',
      intro: 'ใช้ mock login สำหรับสร้าง project และทดลองแยก UI assets ในเครื่อง',
      name: 'ชื่อ',
      email: 'อีเมล',
      submit: 'Login'
    }
  },
  en: {
    nav: {
      home: 'Home',
      login: 'Login',
      language: 'Language'
    },
    home: {
      metaDescription: 'Capture website UI and export cards, icons, and layers as PNG assets.',
      title: 'Extract_',
      intro: 'A browser-to-asset workspace for turning real websites into reusable PNG layers, surfaces, and metadata that agents or designers can inspect.',
      start: 'Start Extracting',
      workspace: 'Open Workspace',
      signals: ['5-minute setup', 'PNG layers', 'Metadata ready', 'No mock assets'],
      proofEyebrow: 'Website-to-layer proof',
      proofTitle: 'One URL becomes inspectable asset files',
      stats: ['Assets exported', 'UI blocks', 'Card surfaces', 'Broken layers'],
      selectedLayer: 'Selected layer',
      kind: 'Kind',
      bounds: 'Bounds',
      export: 'Export',
      use: 'Use',
      featureEyebrow: 'Complete UI extraction',
      featureTitle: 'Everything you need to automate website asset capture',
      workflowEyebrow: 'The extraction layer',
      workflowTitle: 'Connect a live webpage to clean reusable outputs',
      capabilities: [
        {
          title: 'Capture the page',
          detail: 'Render a real URL, preserve full-page context, and keep the original screen as source proof.'
        },
        {
          title: 'Split UI surfaces',
          detail: 'Detect cards, layout regions, foreground content, and reusable surface-only images.'
        },
        {
          title: 'Inspect metadata',
          detail: 'Keep selectors, classes, bounds, kind, and depth next to every exported image.'
        },
        {
          title: 'Browse outputs',
          detail: 'Filter cards, buttons, icons, fields, navigation, media, layout, and content in one workspace.'
        },
        {
          title: 'Export PNG layers',
          detail: 'Generate transparent layers and clean card surfaces ready for design or agent workflows.'
        },
        {
          title: 'Repeat per project',
          detail: 'Save URLs in a project, rerun extraction, and compare outputs without rebuilding setup.'
        }
      ],
      outputAssets: [
        {
          title: 'Original capture',
          description: 'Full browser render kept as source proof before any layer split.',
          kind: 'source capture',
          useCase: 'Audit visual parity'
        },
        {
          title: 'Screen surface',
          description: 'Cleaned page surface without foreground content noise.',
          kind: 'background layer',
          useCase: 'Rebuild layout shell'
        },
        {
          title: 'Info layer',
          description: 'Detected content region with text and UI context preserved.',
          kind: 'content layer',
          useCase: 'Inspect selectors'
        },
        {
          title: 'Card surface',
          description: 'Reusable card-only surface separated from the page.',
          kind: 'card surface',
          useCase: 'Design handoff'
        }
      ],
      architectureNodes: ['URL capture', 'DOM + visual pass', 'Layer classifier', 'PNG exporter', 'Metadata index']
    },
    login: {
      title: 'Login | SeparateWeb',
      eyebrow: 'Login',
      heading: 'Enter your workspace',
      intro: 'Use mock login to create projects and try extracting UI assets locally.',
      name: 'Name',
      email: 'Email',
      submit: 'Login'
    }
  }
} as const

export const useLocale = () => {
  const locale = useState<LocaleCode>('locale', () => 'th')
  const t = computed(() => messages[locale.value])

  const setLocale = (nextLocale: LocaleCode) => {
    locale.value = nextLocale

    if (import.meta.client) {
      localStorage.setItem('separateweb-locale', nextLocale)
      document.documentElement.lang = nextLocale
    }
  }

  const toggleLocale = () => {
    setLocale(locale.value === 'th' ? 'en' : 'th')
  }

  onMounted(() => {
    const savedLocale = localStorage.getItem('separateweb-locale')

    if (savedLocale === 'th' || savedLocale === 'en') {
      locale.value = savedLocale
    }

    document.documentElement.lang = locale.value
  })

  return {
    locale,
    t,
    setLocale,
    toggleLocale
  }
}
