# 🚑 Smart Rescuer Ring

**AI-Powered Emergency Response System**

تطبيق ذكي للطوارئ الطبية يستخدم الذكاء الاصطناعي لتحليل الحالات الطارئة في الوقت الفعلي.

---

## 📋 وصف المشروع | Project Description

**Smart Rescuer** هو تطبيق موبايل متطور (React Native + Expo) مصمم للمسعفين والمنقذين. يوفر:

- 🎯 **كشف AI بالكاميرا**: يكتشف النزيف، الكسور، الحروق، السقوط، والإغماء
- 💓 **مراقبة العلامات الحيوية**: نبض القلب، الأكسجين في الدم (SpO2)
- 🤖 **تحليل Gemini AI**: تشخيص ذكي للإصابات بالصور
- 📊 **Dashboard مراقبة**: متابعة حالات الطوارئ في الوقت الفعلي
- 🔴 **نظام SOS**: إنذار الطوارئ حسب الأولوية

**التقنيات المستخدمة:**
- React Native 0.81 + Expo SDK 54
- Express.js Backend + Drizzle ORM
- Google Gemini AI API
- Reanimated للرسوم المتحركة
- PostgreSQL Database

---

## ✨ الميزات الرئيسية | Features

| الميزة | الوصف |
|--------|-------|
| 🎥 **AI Vision** | كشف 6 سيناريوهات طارئة بالكاميرا |
| 💡 **YOLOv8n** | محاكاة كشف الأجسام في الوقت الفعلي |
| 🏥 **Vital Signs** | عرض BPM و SpO2 |
| 🚨 **Emergency Levels** | Normal → Warning → Emergency |
| 📱 **Cross-Platform** | iOS + Android + Web |
| 🔒 **Offline Ready** | يعمل بدون إنترنت |

---

## 🚀 طريقة التثبيت | Installation

### المتطلبات | Requirements
- Node.js v18 أو أحدث
- npm أو yarn
- Git

### 1. نسخ المستودع | Clone Repository

```bash
git clone https://github.com/fhrrutedf/Smart-Rescure-Ring.git
cd Smart-Rescure-Ring
```

### 2. تثبيت الـ Dependencies | Install Dependencies

```bash
npm install
```

### 3. إعداد المتغيرات البيئية | Environment Setup

سوي ملف `.env` في مجلد المشروع:

```env
# Google Gemini API Key (اختياري للـ AI Analysis)
GEMINI_API_KEY=your_gemini_api_key_here

# Database (اختياري)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Server Port
PORT=5000
```

### 4. تشغيل التطبيق | Run the App

**للتطوير (Expo):**
```bash
npm run expo:dev
```
افتح التطبيق في محاكي أو موبايلك باستخدام تطبيق **Expo Go**.

**تشغيل السيرفر فقط:**
```bash
npm run server:dev
```
السيرفر يشتغل على: http://localhost:5000

**Dashboard:**
افتح في المتصفح: http://localhost:5000/dashboard

---

## 📱 كيفية الاستخدام | Usage

1. **افتح الكاميرا** - التطبيق يبدأ بكشف AI تلقائي
2. **راقب الشاشة** - المربعات الملونة = كشف إصابات
3. **تابع الـ Vitals** - القلب والأكسجين في الأسفل
4. **الإنذارات** - أحمر = طارئ، أصفر = تحذير، أزرق = طبيعي
5. **التقرير** - Dashboard يحفظ كل الحالات

---

## 🛠️ Scripts متوفرة | Available Scripts

| الأمر | الوصف |
|-------|-------|
| `npm run expo:dev` | تشغيل تطبيق Expo للتطوير |
| `npm run server:dev` | تشغيل Express السيرفر |
| `npm run server:prod` | تشغيل السيرفر للإنتاج |
| `npm start` | تشغيل Expo (افتراضي) |
| `npm run lint` | فحص الكود |
| `npm run db:push` | تحديث قاعدة البيانات |

---

## 🏗️ هيكل المشروع | Project Structure

```
Smart-Rescure-Ring/
├── app/                    # شاشات التطبيق (Expo Router)
│   ├── index.tsx          # الشاشة الرئيسية
│   └── _layout.tsx        # التخطيط
├── components/            # مكونات React Native
│   ├── CameraSection.tsx  # الكاميرا + AI Detection
│   ├── VitalsPanel.tsx    # العلامات الحيوية
│   └── DiagnosisPanel.tsx # التشخيص
├── server/                # Backend Express
│   ├── index.ts           # نقطة الدخول
│   ├── routes.ts          # API Routes
│   └── gemini-service.ts  # Google AI
├── constants/             # الثوابت والألوان
├── contexts/              # React Context
└── package.json
```

---

## 🤝 المساهمة | Contributing

المشروع مفتوح المصدر! نرحب بالمساهمات:

1. Fork الريبو
2. سوي Branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. افتح Pull Request

---

## 👨‍💻 المطور | Developer

**Nawaf & Mulk Allah AI Lab**

📧 للاستفسار: افتح issue في GitHub

---

## 📄 الترخيص | License

MIT License - استخدم المشروع بحرية!

---

<div align="center">
  <h3>🚀 Ready to Save Lives!</h3>
  <p>Developed with ❤️ by Nawaf</p>
</div>
