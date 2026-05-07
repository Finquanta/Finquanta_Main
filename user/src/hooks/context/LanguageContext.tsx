"use client";
import { createContext, useContext, useState, ReactNode } from "react";

const translations: Record<string, Record<string, Record<string, string>>> = {
  en: {
    nav: { features: "Features", faqs: "FAQs", newsletter: "Newsletter", community: "Community", blog: "Blog", scheduleDemo: "Schedule Demo", signUp: "Sign Up", login: "Login" },
    hero: { title: "Transform Your Finances with AI Power!", description: "Revolutionize your finances with our AI-powered app. Effortlessly track expenses, optimize investments, and reach your goals all in one place.", subscribe: "Subscribe now", emailPlaceholder: "Enter your email", notice: "Sign up to Finquanta AI newsletter for all the latest news, trends and insights from our industry experts." },
    features: { banner: "Optimizing financial decisions through powerful AI technology.", title: "Our AI assistant focuses on what matters most", tagline: "delivering smart financial strategies for your business.", maturity: "Maturity", maturityDesc: "Smart strategies for every stage, from startup to growth.", nature: "Nature", natureDesc: "Industry-specific insights to help you make better decisions.", niche: "Niche", nicheDesc: "Financial guidance based on your business model and operations.", financialHealth: "Financial Health", financialHealthDesc: "Stay on top of your business cash flow, expenses, and profits." },
    faq: { title: "Frequently Asked Questions", q1: "How much does Finquanta AI cost?", a1: "We offer a free plan with essential tools, plus paid plans starting at $49.99/month.", q2: "How does Finquanta AI work?", a2: "Our AI analyzes your business finances and provides smart recommendations.", q3: "What are the benefits of using Finquanta AI?", a3: "Save time, make smarter financial decisions, and get AI-powered insights." },
    newsletter: { title: "Stay in the know", description: "Sign up to Finquanta AI newsletter for all the latest news, trends and insights from our industry experts.", emailPlaceholder: "Enter your email", subscribe: "Subscribe now" },
    community: { title: "You can also connect with us on" },
    footer: { terms: "terms of service", privacy: "privacy notice", aiRisk: "ai risk disclosure" },
    legal: { returnHome: "Return to Home Page", termsTitle: "FINQUANTA TERMS OF SERVICE", termsIntro: "These Terms of Service govern your access to and use of the Finquanta platform. By creating an account or using the platform, you agree to be bound by these terms.", privacyTitle: "FINQUANTA PRIVACY NOTE", privacyIntro: "Finquanta is committed to protecting the privacy and security of the business and financial information entrusted to us by our users.", aiRiskTitle: "FINQUANTA AI RISK DISCLOSURE", aiRiskIntro: "Finquanta uses artificial intelligence, machine learning models, and automated systems to help businesses manage financial data, automate bookkeeping processes, and generate financial insights." }
  },
  es: {
    nav: { features: "Caracteristicas", faqs: "Preguntas frecuentes", newsletter: "Boletin", community: "Comunidad", blog: "Blog", scheduleDemo: "Programar Demo", signUp: "Registrarse", login: "Iniciar sesion" },
    hero: { title: "Transforma tus Finanzas con el Poder de la IA!", description: "Revoluciona tus finanzas con nuestra aplicacion impulsada por IA.", subscribe: "Suscribirse", emailPlaceholder: "Ingresa tu correo", notice: "Suscribete al boletin de Finquanta AI para las ultimas noticias." },
    features: { banner: "Optimizando decisiones financieras con tecnologia de IA.", title: "Nuestro asistente de IA se enfoca en lo que mas importa", tagline: "entregando estrategias financieras inteligentes para tu negocio.", maturity: "Madurez", maturityDesc: "Estrategias inteligentes para cada etapa, desde startup hasta crecimiento.", nature: "Naturaleza", natureDesc: "Perspectivas especificas de la industria para tomar mejores decisiones.", niche: "Nicho", nicheDesc: "Orientacion financiera basada en tu modelo de negocio.", financialHealth: "Salud Financiera", financialHealthDesc: "Mantente al tanto del flujo de caja, gastos y ganancias." },
    faq: { title: "Preguntas Frecuentes", q1: "Cuanto cuesta Finquanta AI?", a1: "Ofrecemos un plan gratuito con herramientas esenciales, mas planes de pago desde $49.99/mes.", q2: "Como funciona Finquanta AI?", a2: "Nuestra IA analiza las finanzas de tu negocio y proporciona recomendaciones inteligentes.", q3: "Cuales son los beneficios de usar Finquanta AI?", a3: "Ahorra tiempo, toma decisiones financieras mas inteligentes." },
    newsletter: { title: "Mantente informado", description: "Suscribete al boletin de Finquanta AI para las ultimas noticias.", emailPlaceholder: "Ingresa tu correo", subscribe: "Suscribirse" },
    community: { title: "Tambien puedes conectarte con nosotros en" },
    footer: { terms: "terminos de servicio", privacy: "aviso de privacidad", aiRisk: "divulgacion de riesgo de IA" },
    legal: { returnHome: "Volver a la pagina principal", termsTitle: "TERMINOS DE SERVICIO DE FINQUANTA", termsIntro: "Estos Terminos de Servicio rigen su acceso y uso de la plataforma Finquanta. Al crear una cuenta o usar la plataforma, acepta estos terminos.", privacyTitle: "AVISO DE PRIVACIDAD DE FINQUANTA", privacyIntro: "Finquanta se compromete a proteger la privacidad y seguridad de la informacion financiera y empresarial confiada por nuestros usuarios.", aiRiskTitle: "DIVULGACION DE RIESGO DE IA DE FINQUANTA", aiRiskIntro: "Finquanta utiliza inteligencia artificial, modelos de aprendizaje automatico y sistemas automatizados para ayudar a las empresas a gestionar datos financieros." }
  },
  fr: {
    nav: { features: "Fonctionnalites", faqs: "FAQ", newsletter: "Newsletter", community: "Communaute", blog: "Blog", scheduleDemo: "Planifier une demo", signUp: "S inscrire", login: "Connexion" },
    hero: { title: "Transformez vos finances avec la puissance de l IA!", description: "Revolutionnez vos finances avec notre application alimentee par l IA.", subscribe: "S abonner", emailPlaceholder: "Entrez votre email", notice: "Inscrivez-vous a la newsletter Finquanta AI pour les dernieres nouvelles." },
    features: { banner: "Optimiser les decisions financieres grace a la puissante technologie IA.", title: "Notre assistant IA se concentre sur ce qui compte le plus", tagline: "fournir des strategies financieres intelligentes pour votre entreprise.", maturity: "Maturite", maturityDesc: "Des strategies intelligentes pour chaque etape, du demarrage a la croissance.", nature: "Nature", natureDesc: "Des informations specifiques a l industrie pour prendre de meilleures decisions.", niche: "Niche", nicheDesc: "Conseils financiers bases sur votre modele d entreprise.", financialHealth: "Sante Financiere", financialHealthDesc: "Gardez le controle de vos flux de tresorerie, depenses et benefices." },
    faq: { title: "Questions Frequemment Posees", q1: "Combien coute Finquanta AI?", a1: "Nous offrons un plan gratuit avec des outils essentiels, plus des plans payants a partir de 49,99$/mois.", q2: "Comment fonctionne Finquanta AI?", a2: "Notre IA analyse vos finances d entreprise et fournit des recommandations intelligentes.", q3: "Quels sont les avantages de Finquanta AI?", a3: "Gagnez du temps, prenez de meilleures decisions financieres." },
    newsletter: { title: "Restez informe", description: "Inscrivez-vous a la newsletter Finquanta AI pour les dernieres nouvelles.", emailPlaceholder: "Entrez votre email", subscribe: "S abonner" },
    community: { title: "Vous pouvez egalement nous rejoindre sur" },
    footer: { terms: "conditions d utilisation", privacy: "avis de confidentialite", aiRisk: "divulgation des risques IA" },
    legal: { returnHome: "Retour a la page d accueil", termsTitle: "CONDITIONS D UTILISATION DE FINQUANTA", termsIntro: "Ces conditions d utilisation regissent votre acces et votre utilisation de la plateforme Finquanta. En creant un compte ou en utilisant la plateforme, vous acceptez ces conditions.", privacyTitle: "AVIS DE CONFIDENTIALITE DE FINQUANTA", privacyIntro: "Finquanta s engage a proteger la confidentialite et la securite des informations financieres et commerciales confiees par nos utilisateurs.", aiRiskTitle: "DIVULGATION DES RISQUES IA DE FINQUANTA", aiRiskIntro: "Finquanta utilise l intelligence artificielle, des modeles d apprentissage automatique et des systemes automatises pour aider les entreprises a gerer les donnees financieres." }
  },
  pt: {
    nav: { features: "Recursos", faqs: "Perguntas frequentes", newsletter: "Newsletter", community: "Comunidade", blog: "Blog", scheduleDemo: "Agendar Demo", signUp: "Cadastrar", login: "Entrar" },
    hero: { title: "Transforme suas Financas com o Poder da IA!", description: "Revolucione suas financas com nosso aplicativo de IA.", subscribe: "Inscrever-se", emailPlaceholder: "Digite seu email", notice: "Inscreva-se na newsletter da Finquanta AI para as ultimas noticias." },
    features: { banner: "Otimizando decisoes financeiras com tecnologia de IA poderosa.", title: "Nosso assistente de IA foca no que mais importa", tagline: "entregando estrategias financeiras inteligentes para o seu negocio.", maturity: "Maturidade", maturityDesc: "Estrategias inteligentes para cada etapa, do startup ao crescimento.", nature: "Natureza", natureDesc: "Insights especificos do setor para tomar melhores decisoes.", niche: "Nicho", nicheDesc: "Orientacao financeira baseada no seu modelo de negocio.", financialHealth: "Saude Financeira", financialHealthDesc: "Fique por dentro do fluxo de caixa, despesas e lucros." },
    faq: { title: "Perguntas Frequentes", q1: "Quanto custa o Finquanta AI?", a1: "Oferecemos um plano gratuito com ferramentas essenciais, mais planos pagos a partir de $49,99/mes.", q2: "Como funciona o Finquanta AI?", a2: "Nossa IA analisa as financas do seu negocio e fornece recomendacoes inteligentes.", q3: "Quais sao os beneficios do Finquanta AI?", a3: "Economize tempo, tome decisoes financeiras mais inteligentes." },
    newsletter: { title: "Fique por dentro", description: "Inscreva-se na newsletter da Finquanta AI para as ultimas noticias.", emailPlaceholder: "Digite seu email", subscribe: "Inscrever-se" },
    community: { title: "Voce tambem pode se conectar conosco em" },
    footer: { terms: "termos de servico", privacy: "aviso de privacidade", aiRisk: "divulgacao de risco de IA" },
    legal: { returnHome: "Voltar para a pagina inicial", termsTitle: "TERMOS DE SERVICO DA FINQUANTA", termsIntro: "Estes Termos de Servico regem o seu acesso e uso da plataforma Finquanta. Ao criar uma conta ou usar a plataforma, voce concorda com estes termos.", privacyTitle: "AVISO DE PRIVACIDADE DA FINQUANTA", privacyIntro: "A Finquanta esta comprometida em proteger a privacidade e seguranca das informacoes financeiras e empresariais confiadas pelos nossos usuarios.", aiRiskTitle: "DIVULGACAO DE RISCO DE IA DA FINQUANTA", aiRiskIntro: "A Finquanta utiliza inteligencia artificial, modelos de aprendizado de maquina e sistemas automatizados para ajudar empresas a gerenciar dados financeiros." }
  },
  ar: {
    nav: { features: "الميزات", faqs: "الأسئلة الشائعة", newsletter: "النشرة الإخبارية", community: "المجتمع", blog: "المدونة", scheduleDemo: "جدولة عرض", signUp: "التسجيل", login: "تسجيل الدخول" },
    hero: { title: "حول أموالك بقوة الذكاء الاصطناعي!", description: "أحدث ثورة في أموالك مع تطبيقنا.", subscribe: "اشترك الآن", emailPlaceholder: "أدخل بريدك الإلكتروني", notice: "اشترك في نشرة Finquanta AI الإخبارية." },
    features: { banner: "تحسين القرارات المالية من خلال تقنية الذكاء الاصطناعي.", title: "يركز مساعدنا الذكي على ما يهم أكثر", tagline: "تقديم استراتيجيات مالية ذكية لعملك.", maturity: "النضج", maturityDesc: "استراتيجيات ذكية لكل مرحلة.", nature: "الطبيعة", natureDesc: "رؤى خاصة بالصناعة.", niche: "المجال", nicheDesc: "توجيه مالي بناء على نموذج عملك.", financialHealth: "الصحة المالية", financialHealthDesc: "ابق على اطلاع على التدفق النقدي والمصروفات." },
    faq: { title: "الأسئلة الشائعة", q1: "كم تكلفة Finquanta AI؟", a1: "نقدم خطة مجانية بأدوات أساسية، بالإضافة إلى خطط مدفوعة.", q2: "كيف يعمل Finquanta AI؟", a2: "يحلل الذكاء الاصطناعي ماليات عملك ويقدم توصيات ذكية.", q3: "ما فوائد استخدام Finquanta AI؟", a3: "وفر الوقت واتخذ قرارات مالية أذكى." },
    newsletter: { title: "ابق على اطلاع", description: "اشترك في نشرة Finquanta AI الإخبارية.", emailPlaceholder: "أدخل بريدك الإلكتروني", subscribe: "اشترك الآن" },
    community: { title: "يمكنك أيضا التواصل معنا على" },
    footer: { terms: "شروط الخدمة", privacy: "إشعار الخصوصية", aiRisk: "الإفصاح عن مخاطر الذكاء الاصطناعي" },
    legal: { returnHome: "العودة إلى الصفحة الرئيسية", termsTitle: "شروط خدمة فينكوانتا", termsIntro: "تحكم شروط الخدمة هذه وصولك واستخدامك لمنصة Finquanta. بإنشاء حساب أو استخدام المنصة، فإنك توافق على هذه الشروط.", privacyTitle: "إشعار الخصوصية لفينكوانتا", privacyIntro: "تلتزم Finquanta بحماية خصوصية وأمان المعلومات المالية والتجارية التي يعهد بها إلينا مستخدمونا.", aiRiskTitle: "إفصاح مخاطر الذكاء الاصطناعي لفينكوانتا", aiRiskIntro: "تستخدم Finquanta الذكاء الاصطناعي ونماذج التعلم الآلي والأنظمة الآلية لمساعدة الشركات على إدارة البيانات المالية." }
  },
  zh: {
    nav: { features: "功能", faqs: "常见问题", newsletter: "新闻通讯", community: "社区", blog: "博客", scheduleDemo: "预约演示", signUp: "注册", login: "登录" },
    hero: { title: "用AI的力量改变您的财务!", description: "用我们的AI驱动应用革新您的财务。", subscribe: "立即订阅", emailPlaceholder: "输入您的邮箱", notice: "订阅Finquanta AI新闻通讯。" },
    features: { banner: "通过强大的AI技术优化财务决策。", title: "我们的AI助手专注于最重要的事情", tagline: "为您的企业提供智能财务策略。", maturity: "成熟度", maturityDesc: "每个阶段的智能策略。", nature: "性质", natureDesc: "行业特定见解。", niche: "细分市场", nicheDesc: "基于您的业务模式的财务指导。", financialHealth: "财务健康", financialHealthDesc: "掌握企业现金流、支出和利润。" },
    faq: { title: "常见问题", q1: "Finquanta AI的费用是多少？", a1: "我们提供免费基础工具计划，付费计划从每月49.99美元起。", q2: "Finquanta AI如何工作？", a2: "我们的AI分析您的企业财务并提供智能建议。", q3: "使用Finquanta AI有什么好处？", a3: "节省时间，做出更明智的财务决策。" },
    newsletter: { title: "保了解", description: "订阅Finquanta AI新闻通讯。", emailPlaceholder: "输入您的邮箱", subscribe: "立即订阅" },
    community: { title: "您也可以在以下平台与我们联系" },
    footer: { terms: "服务条款", aiRisk: "AI风险披露" },
    legal: { returnHome: "返回主页", termsTitle: "FINQUANTA 服务条款", termsIntro: "这些服务条款规范您对 Finquanta 平台的访问和使用。通过创建账户或使用平台，您同意受这些条款的约束。", privacyTitle: "FINQUANTA 隐私声明", privacyIntro: "Finquanta 致力于保护用户委托给我们的商业和财务信息的隐私和安全。", aiRiskTitle: "FINQUANTA 人工智能风险披露", aiRiskIntro: "Finquanta 使用人工智能、机器学习模型和自动化系统帮助企业管理财务数据。" }
  },
  ja: {
    nav: { features: "機能", faqs: "よくある質問", newsletter: "ニュースレター", community: "コミュニティ", blog: "ブログ", scheduleDemo: "デモを予約", signUp: "サインアップ", login: "ログイン" },
    hero: { title: "AIの力で財務を変革!", description: "AIを搭載したアプリで財務を革新しましょう。", subscribe: "今すぐ登録", emailPlaceholder: "メールアドレスを入力", notice: "Finquanta AIニュースレターに登録しましょう。" },
    features: { banner: "強力なAI技術で財務上の意思決定を最適化。", title: "AIアシスタントが最も重要なことに集中します", tagline: "ビジネスに賢い財務戦略を提供。", maturity: "成熟度", maturityDesc: "あらゆる段階のスマートな戦略。", nature: "性質", natureDesc: "業界固有の洞察。", niche: "ニッチ", nicheDesc: "ビジネスモデルに基づく財務ガイダンス。", financialHealth: "財務健全性", financialHealthDesc: "キャッシュフロー、経費、利益を把握しましょう。" },
    faq: { title: "よくある質問", q1: "Finquanta AIの費用はいくらですか？", a1: "無料プランと月額49.99ドルからの有料プランを提供しています。", q2: "Finquanta AIはどのように機能しますか？", a2: "AIがビジネスの財務を分析し、スマートな推奨事項を提供します。", q3: "Finquanta AIを使用するメリットは？", a3: "時間を節約し、よりスマートな財務決定を行えます。" },
    newsletter: { title: "最新情報を入手", description: "Finquanta AIニュースレターに登録しましょう。", emailPlaceholder: "メールアドレスを入力", subscribe: "今すぐ登録" },
    community: { title: "以下のプラットフォームでもつながれます" },
    footer: { terms: "利用規約", privacy: "プライバシー" },
    legal: { returnHome: "ホームページに戻る", termsTitle: "FINQUANTA 利用規約", termsIntro: "この利用規約は、Finquantaプラットフォームへのアクセスおよび利用を規定します。アカウントを作成またはプラットフォームを使用することで、これらの規約に同意したことになります。", privacyTitle: "FINQUANTA プライバシーポリシー", privacyIntro: "Finquantaは、ユーザーから預かるビジネスおよび財務情報のプライバシーとセキュリティを保護することを約束します。", aiRiskTitle: "FINQUANTA AIリスク開示", aiRiskIntro: "Finquantaは、人工知能、機械学習モデル、自動化システムを使用して、企業が財務データを管理できるよう支援します。" }
  },
  ru: {
    nav: { features: "Функции", faqs: "Вопросы и ответы", newsletter: "Рассылка", community: "Сообщество", blog: "Блог", scheduleDemo: "Запланировать демо", signUp: "Регистрация", login: "Войти" },
    hero: { title: "Преобразуйте свои финансы с помощью ИИ!", description: "Революционизируйте свои финансы с нашим приложением на базе ИИ.", subscribe: "Подписаться", emailPlaceholder: "Введите ваш email", notice: "Подпишитесь на рассылку Finquanta AI." },
    features: { banner: "Оптимизация финансовых решений с помощью ИИ.", title: "Ассистент фокусируется на самом важном", tagline: "предоставляя умные финансовые стратегии для вашего бизнеса.", maturity: "Зрелость", maturityDesc: "Умные стратегии для каждого этапа.", nature: "Природа", natureDesc: "Отраслевые инсайты.", niche: "Новое руководство на основе вашей бизнес-модели.", financialHealth: "Финансовое здоровье", financialHealthDesc: "Следите за денежным потоком, расходами и прибылью." },
    faq: { title: "Часто задаваемые вопросы", q1: "Сколько стоит Finquanta AI?", a1: "Мы предлагаем бесплатный план и платные планы от 49,99$/месяц.", q2: "Как работает Finquanta AI?", a2: "ИИ анализирует финансы вашего бизнеса и даёт рекомендации.", q3: "Каковы преимущества Finquanta AI?", a3: "Экономьте время и принимайте взвешенные финансовые решения." },
    newsletter: { title: "Будьте в курсе", description: "Подпишитесь на рассылку Finquanta AI.", emailPlaceholder: "Введите ваш email", subscribe: "Подписаться" },
    community: { title: "Вы также можете связаться с нами в" },
    footer: { terms: "условия обслуживания", privacy: "конфиденциальность", aiRisk: "раскрытие рисков ИИ" },
    legal: { returnHome: "Вернуться на главную страницу", termsTitle: "УСЛОВИЯ ОБСЛУЖИВАНИЯ FINQUANTA", termsIntro: "Настоящие Условия обслуживания регулируют ваш доступ к платформе Finquanta и её использование. Создавая учётную запись или используя платформу, вы соглашаетесь с этими условиями.", privacyTitle: "УВЕДОМЛЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ FINQUANTA", privacyIntro: "Finquanta стремится защищать конфиденциальность и безопасность деловой и финансовой информации, доверенной нам нашими пользователями.", aiRiskTitle: "РАСКРЫТИЕ РИСКОВ ИИ FINQUANTA", aiRiskIntro: "Finquanta использует искусственный интеллект, модели машинного обучения и автоматизированные системы для помощи предприятиям в управлении финансовыми данными." }
  },
  nl: {
    nav: { features: "Functies", faqs: "Veelgestelde vragen", newsletter: "Nieuwsbrief", community: "Gemeenschap", blog: "Blog", scheduleDemo: "Demo plannen", signUp: "Aanmelden", login: "Inloggen" },
    hero: { title: "Transformeer uw financien met AI-kracht!", description: "Revolutioneer uw financien met onze AI-aangedreven app.", subscribe: "Nu abonneren", emailPlaceholder: "Voer uw e-mail in", notice: "Abonneer u op de Finquanta AI-nieuwsbrief." },
    features: { banner: "Financiele beslissingen optimaliseren met krachtige AI-technologie.", title: "Onze AI-assistent richt zich op wat het meest belangrijk is", tagline: "slimme financiele strategieen leveren voor uw bedrijf.", maturity: "Volwassenheid", maturityDesc: "Slimme strategieen voor elke fase.", nature: "Natuur", natureDesc: "Branchespecifieke inzichten.", niche: "Niche", nicheDesc: "Financiele begeleiding op basis van uw bedrijfsmodel.", financialHealth: "Financiele Gezondheid", financialHealthDesc: "Houd uw cashflow, uitgaven en winsten bij." },
    faq: { title: "Veelgestelde Vragen", q1: "Hoeveel kost Finquanta AI?", a1: "We bieden een gratis plan plus betaalde plannen vanaf $49,99/maand.", q2: "Hoe werkt Finquanta AI?", a2: "Onze AI analyseert uw bedrijfsfinancien en geeft aanbevelingen.", q3: "Wat zijn de voordelen van Finquanta AI?", a3: "Bespaar tijd en neem slimmere financiele beslissingen." },
    newsletter: { title: "Blijf op de hoogte", description: "Abonneer u op de Finquanta AI-nieuwsbrief.", emailPlaceholder: "Voer uw e-mail in", subscribe: "Nu abonneren" },
    community: { title: "U kunt ook contact met ons opnemen via" },
    footer: { terms: "servicevoorwaarden", privacy: "privacymelding", aiRisk: "AI-risicomelding" },
    legal: { returnHome: "Terug naar de startpagina", termsTitle: "FINQUANTA SERVICEVOORWAARDEN", termsIntro: "Deze servicevoorwaarden regelen uw toegang tot en gebruik van het Finquanta-platform. Door een account aan te maken of het platform te gebruiken, gaat u akkoord met deze voorwaarden.", privacyTitle: "FINQUANTA PRIVACYVERKLARING", privacyIntro: "Finquanta zet zich in voor de bescherming van de privacy en veiligheid van de bedrijfs- en financiele informatie die onze gebruikers aan ons toevertrouwen.", aiRiskTitle: "FINQUANTA AI-RISICOMELDING", aiRiskIntro: "Finquanta gebruikt kunstmatige intelligentie, machine learning-modellen en geautomatiseerde systemen om bedrijven te helpen financiele gegevens te beheren." }
  },
  de: {
    nav: { features: "Funktionen", faqs: "Haufige Fragen", newsletter: "Newsletter", community: "Gemeinschaft", blog: "Blog", scheduleDemo: "Demo planen", signUp: "Registrieren", login: "Anmelden" },
    hero: { title: "Transformieren Sie Ihre Finanzen mit KI-Kraft!", description: "Revolutionieren Sie Ihre Finanzen mit unserer KI-gestutzten App.", subscribe: "Jetzt abonnieren", emailPlaceholder: "E-Mail eingeben", notice: "Abonnieren Sie den Finquanta AI-Newsletter." },
    features: { banner: "Finanzielle Entscheidungen durch leistungsstarke KI-Technologie optimieren.", title: "Unser KI-Assistent konzentriert sich auf das Wichtigste", tagline: "intelligente Finanzstrategien fur Ihr Unternehmen liefern.", maturity: "Reife", maturityDesc: "Intelligente Strategien fur jede Phase.", nature: "Natur", natureDesc: "Branchenspezifische Einblicke.", niche: "Nische", nicheDesc: "Finanzielle Beratung basierend auf Ihrem Geschaftsmodell.", financialHealth: "Finanzielle Gesundheit", financialHealthDesc: "Behalten Sie Ihren Cashflow, Ausgaben und Gewinne im Blick." },
    faq: { title: "Haufig gestellte Fragen", q1: "Wie viel kostet Finquanta AI?", a1: "Wir bieten einen kostenlosen Plan sowie kostenpflichtige Plane ab 49,99$/Monat.", q2: "Wie funktioniert Finquanta AI?", a2: "Unsere KI analysiert Ihre Unternehmensfinanzen und gibt Empfehlungen.", q3: "Was sind die Vorteile von Finquanta AI?", a3: "Sparen Sie Zeit und treffen Sie klugere Finanzentscheidungen." },
    newsletter: { title: "Bleiben Sie informiert", description: "Abonnieren Sie den Finquanta AI-Newsletter.", emailPlaceholder: "E-Mail eingeben", subscribe: "Jetzt abonnieren" },
    community: { title: "Sie konnen uns auch auf folgenden Plattformen finden" },
    footer: { terms: "Nutzungsbedingungen", privacy: "Datenschutzhinweis", aiRisk: "KI-Risikooffenlegung" },
    legal: { returnHome: "Zur Startseite zuruckkehren", termsTitle: "FINQUANTA NUTZUNGSBEDINGUNGEN", termsIntro: "Diese Nutzungsbedingungen regeln Ihren Zugang zur und die Nutzung der Finquanta-Plattform. Durch die Erstellung eines Kontos oder die Nutzung der Plattform stimmen Sie diesen Bedingungen zu.", privacyTitle: "FINQUANTA DATENSCHUTZHINWEIS", privacyIntro: "Finquanta ist bestrebt, die Privatsphare und Sicherheit der uns von unseren Nutzern anvertrauten Geschafts- und Finanzdaten zu schutzen.", aiRiskTitle: "FINQUANTA KI-RISIKOOFFENLEGUNG", aiRiskIntro: "Finquanta verwendet kunstliche Intelligenz, maschinelle Lernmodelle und automatisierte Systeme, um Unternehmen bei der Verwaltung von Finanzdaten zu unterstutzen." }
  }
};

type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  t: (section: string, key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (section, key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState("en");

  const t = (section: string, key: string): string => {
    return translations[language]?.[section]?.[key] || translations["en"]?.[section]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
