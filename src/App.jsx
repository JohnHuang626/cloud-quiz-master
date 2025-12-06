import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  signOut,                   
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  Settings, 
  User, 
  GraduationCap,
  FileText,
  Save,
  RefreshCcw,
  UploadCloud,
  Play,
  Columns,
  Maximize,
  Image as ImageIcon,
  BarChart3, 
  Clock,
  RotateCcw,
  AlertCircle,
  Lock, 
  Key,  
  LogOut,
  Shuffle,
  Eye,
  EyeOff,
  Download,
  Folder,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  History, 
  TrendingUp,
  FolderX,
  ImageOff,
  Pencil,
  Upload,
  ArrowDown01,
  ArrowUp01,
  Printer,
  BookOpenCheck,
  CloudLightning,
  Mail,
  ScrollText,
  Trophy,
  X
} from 'lucide-react';

// --- Firebase 初始化 ---
// 請將以下的字串換成您 Firebase 後台顯示的真實資料
const firebaseConfig = {
  apiKey: "AIzaSyCCy_dv6TY4cKHlXKMNYDBOl4HFgjrY_NU",
  authDomain: "quiz-master-final-v2.firebaseapp.com",
  projectId: "quiz-master-final-v2",
  storageBucket: "quiz-master-final-v2.firebasestorage.app",
  messagingSenderId: "867862608300",
  appId: "1:867862608300:web:f6d23736cccdfec6ab6209"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const appId = 'cloud-quiz-master-v1'; // 固定 appId

// --- 分類定義 (繁體中文) ---
const SUBJECTS = ["國文", "英語", "數學", "自然", "地理", "歷史", "公民", "其他"];
const VOLUMES = ["第一冊", "第二冊", "第三冊", "第四冊", "第五冊", "第六冊", "總複習", "不分冊"];

// --- 元件: 載入中 ---
const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-8 text-blue-600">
    <RefreshCcw className="animate-spin w-8 h-8" />
    <span className="ml-2">連線題庫中...</span>
  </div>
);

// --- 元件: 穩健的圖片顯示 ---
const RobustImage = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  if (!src) return null;
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 border border-slate-200 rounded p-2 ${className}`} style={{minHeight: '100px'}}>
        <ImageOff className="w-6 h-6 mb-1" />
        <span className="text-[10px]">載入失敗</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
};

// --- 輔助函式 ---
const shuffleQuestionOptions = (question) => {
  const indices = question.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledOptions = indices.map(i => question.options[i]);
  const newCorrectIndex = indices.indexOf(question.correctIndex);
  return { ...question, options: shuffledOptions, correctIndex: newCorrectIndex };
};

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- 主應用程式 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ revealThreshold: 60 });
  const [loading, setLoading] = useState(true);
  const [isSplitScreen, setIsSplitScreen] = useState(false); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u || !u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions');
    const unsubQuestions = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const getTime = (t) => t?.toMillis ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : 0);
      docs.sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
      setQuestions(docs);
    });
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'quiz_settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) setGlobalSettings(docSnap.data());
    });
    return () => { unsubQuestions(); unsubSettings(); };
  }, [user]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <header className="bg-indigo-600 text-white shadow-lg shrink-0 z-20 relative">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wide hidden sm:block">雲端測驗大師 v3.2</h1>
            <h1 className="text-xl font-bold tracking-wide sm:hidden">測驗大師</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSplitScreen(!isSplitScreen)}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-4 py-2 rounded text-sm transition border border-white/30 text-white font-bold shadow-sm"
            >
              {isSplitScreen ? <Maximize className="w-4 h-4"/> : <Columns className="w-4 h-4"/>}
              <span className="hidden sm:inline">{isSplitScreen ? '切換回單視窗' : '開啟雙人測試模式'}</span>
              <span className="sm:hidden">{isSplitScreen ? '單視窗' : '雙視窗'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`flex-1 relative ${isSplitScreen ? 'flex divide-x-4 divide-slate-300' : ''}`}>
        <div className={`bg-slate-50 ${isSplitScreen ? 'w-1/2 overflow-y-auto h-[calc(100vh-64px)]' : 'w-full'}`}>
          <QuizSession 
            questions={questions} 
            globalSettings={globalSettings}
            user={user}
            label={isSplitScreen ? "左側視窗 (建議: 老師)" : ""} 
          />
        </div>
        {isSplitScreen && (
          <div className="w-1/2 bg-slate-100 overflow-y-auto h-[calc(100vh-64px)] shadow-inner">
            <QuizSession 
              questions={questions} 
              globalSettings={globalSettings}
              user={user}
              label="右側視窗 (建議: 學生)" 
            />
          </div>
        )}
      </div>
    </div>
  );
}

function QuizSession({ questions, globalSettings, user, label }) {
  const isTeacher = user && !user.isAnonymous;
  const isStudent = user && user.isAnonymous;

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto relative">
      {label && (
        <div className="sticky top-0 right-0 left-0 z-10 flex justify-end pointer-events-none mb-2">
           <div className="text-xs font-bold text-slate-500 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1 rounded-full shadow-sm">
             {label}
           </div>
        </div>
      )}
      
      {user && (
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-slate-500">
                目前身分: <span className={`font-bold ${isTeacher ? 'text-emerald-600' : 'text-indigo-600'}`}>{isTeacher ? '👨‍🏫 老師 (後台管理)' : '👨‍🎓 學生 (測驗模式)'}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="text-sm text-slate-500 hover:text-red-600 underline flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              登出
            </button>
        </div>
      )}

      {!user && <LandingPage questionCount={questions.length} />}
      {isTeacher && <TeacherDashboard questions={questions} globalSettings={globalSettings} userId={user.uid} />}
      {isStudent && <StudentDashboard questions={questions} globalSettings={globalSettings} />}
    </div>
  );
}

function LandingPage({ questionCount }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleStudentLogin = async () => {
      try {
          await signInAnonymously(auth);
      } catch (error) {
          console.error("Student login failed", error);
          alert("登入失敗，請檢查網路連線");
      }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error);
        setErrorMsg('登入失敗：帳號或密碼錯誤');
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-8 animate-fade-in relative">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">歡迎使用即時測驗系統</h2>
        <p className="text-slate-500">目前題庫共有 <span className="font-bold text-indigo-600 text-xl">{questionCount}</span> 道題目</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-lg">
        <button 
          onClick={handleStudentLogin}
          className="group relative flex flex-col items-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-indigo-400"
        >
          <div className="bg-indigo-100 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold mb-1">我是學生</h3>
          <p className="text-gray-400 text-center text-xs">免註冊，直接進入測驗</p>
        </button>

        <button 
          onClick={() => setShowLoginModal(true)}
          className="group relative flex flex-col items-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-emerald-400"
        >
          <div className="bg-emerald-100 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform relative">
            <GraduationCap className="w-8 h-8 text-emerald-600" />
            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-emerald-100">
                <Lock className="w-3 h-3 text-emerald-500" />
            </div>
          </div>
          <h3 className="text-lg font-bold mb-1">我是老師</h3>
          <p className="text-gray-400 text-center text-xs">需使用 Email 帳號登入</p>
        </button>
      </div>

      {showLoginModal && (
        <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl">
            <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200 w-full max-w-xs animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-500" />
                        教師登入
                    </h3>
                    <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleTeacherLogin} className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="email" 
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="teacher@school.com"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">密碼</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="請輸入密碼"
                                required
                            />
                        </div>
                    </div>
                    
                    {errorMsg && <p className="text-xs text-red-500 text-center font-bold">{errorMsg}</p>}
                    
                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-2 rounded-lg transition flex justify-center items-center gap-2"
                    >
                        {isLoggingIn ? <RefreshCcw className="w-4 h-4 animate-spin" /> : '確認登入'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

// --- 頁面: 教師後台 ---
function TeacherDashboard({ questions, globalSettings, userId }) {
  const [activeTab, setActiveTab] = useState('list'); 
  const [selectedSubject, setSelectedSubject] = useState('全部'); 
  const [editingId, setEditingId] = useState(null); 
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const [newQuestion, setNewQuestion] = useState({
    subject: '數學',
    volume: '第一冊',
    unit: '',
    content: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    imageUrl: '',
    rationale: '' 
  });
  
  const [results, setResults] = useState([]);
  const [thresholdInput, setThresholdInput] = useState(globalSettings?.revealThreshold ?? 60);
  const [expandedUnits, setExpandedUnits] = useState({}); 
  const [expandedResultUnits, setExpandedResultUnits] = useState({});

  useEffect(() => {
    if (activeTab === 'results') {
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            docs.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
            setResults(docs);
        }, (error) => {
            console.error("Error fetching results:", error);
        });
        return () => unsubscribe();
    }
  }, [activeTab]);

  const filteredAndGroupedQuestions = useMemo(() => {
    let filtered = questions;
    if (selectedSubject !== '全部') {
        filtered = questions.filter(q => q.subject === selectedSubject);
    }

    const grouped = {};
    filtered.forEach(q => {
      const vol = q.volume || '未分類';
      const unit = q.unit || '一般試題';
      const groupKey = `${vol} | ${unit}`;
      
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(q);
    });
    
    return Object.keys(grouped).sort().reduce((obj, key) => {
        obj[key] = grouped[key];
        return obj;
    }, {});
  }, [questions, selectedSubject]);

  const resultsByUnit = useMemo(() => {
    const grouped = {};
    results.forEach(r => {
      const unit = r.unit || '未分類';
      if (!grouped[unit]) grouped[unit] = [];
      grouped[unit].push(r);
    });
    return Object.keys(grouped).sort().reduce((obj, key) => {
        obj[key] = grouped[key];
        return obj;
    }, {});
  }, [results]);

  const toggleUnit = (unit) => {
    setExpandedUnits(prev => ({ ...prev, [unit]: !prev[unit] }));
  };

  const toggleResultUnit = (unit) => {
    setExpandedResultUnits(prev => ({ ...prev, [unit]: !prev[unit] }));
  };

  const updateThreshold = async () => {
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_settings', 'global'), {
              revealThreshold: Number(thresholdInput)
          }, { merge: true });
          alert(`設定已更新：分數達 ${thresholdInput} 分以上才顯示詳解`);
      } catch (err) {
          console.error("Update settings failed", err);
      }
  };

  const handleExport = () => {
    if (questions.length === 0) return alert("目前沒有題目可以匯出");
    const exportText = questions.map(q => {
        const optionsStr = q.options.join(' | ');
        const answer = q.correctIndex + 1;
        const img = q.imageUrl ? ` | ${q.imageUrl}` : '';
        const sub = q.subject || '其他';
        const vol = q.volume || '不分冊';
        const rat = q.rationale ? ` | ${q.rationale}` : ''; 
        return `${q.content} | ${optionsStr} | ${answer}${img} | ${sub} | ${vol}${rat}`;
    }).join('\n');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_backup_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定要刪除這道題目嗎？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', id));
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const handleEdit = (q) => {
      setNewQuestion({
          subject: q.subject || '數學',
          volume: q.volume || '第一冊',
          unit: q.unit || '',
          content: q.content || '',
          options: q.options || ['', '', '', ''],
          correctIndex: q.correctIndex || 0,
          imageUrl: q.imageUrl || '',
          rationale: q.rationale || ''
      });
      setEditingId(q.id);
      setActiveTab('add');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `artifacts/${appId}/public/images/${fileName}`);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        setNewQuestion({ ...newQuestion, imageUrl: downloadUrl });
    } catch (error) {
        console.error("Upload failed:", error);
        alert("圖片上傳失敗，請檢查網路或稍後再試");
    } finally {
        setIsUploading(false);
    }
  };

  const handleDeleteResult = async (id) => {
    if (window.confirm('確定要刪除這筆成績紀錄嗎？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', id));
      } catch (err) {
        console.error("Delete result failed", err);
      }
    }
  };

  const handleDeleteResultFolder = async (unit, items) => {
    if (window.confirm(`確定要清空「${unit}」資料夾下的所有 ${items.length} 筆成績嗎？此動作無法復原！`)) {
        try {
            const promises = items.map(item => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', item.id)));
            await Promise.all(promises);
            alert(`已清空 ${unit} 的所有成績`);
        } catch (err) {
            console.error("Batch delete results failed", err);
            alert("刪除失敗，請稍後再試");
        }
    }
  };

  const handlePrintMistakes = (result) => {
    if (!result.mistakes || result.mistakes.length === 0) {
      alert("此紀錄無錯題資料或全對，無法列印。");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("請允許彈出視窗以列印。");
        return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>錯題卷 - ${result.studentName}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .question { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fff; }
            .q-content { font-weight: bold; margin-bottom: 10px; font-size: 1.1em; line-height: 1.5; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-left: 20px; }
            .option { padding: 5px; }
            .answer-section { margin-top: 15px; font-size: 0.95em; color: #555; background: #f9f9f9; padding: 10px; border-radius: 6px; border-left: 4px solid #ddd; }
            .correct { color: #10b981; font-weight: bold; }
            .wrong { color: #ef4444; text-decoration: line-through; }
            .rationale { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; font-size: 0.9em; color: #444; }
            .rationale-label { font-weight: bold; color: #d97706; }
            img { max-width: 300px; max-height: 200px; display: block; margin: 10px 0; border: 1px solid #ddd; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; background: #fff; }
              .question { border: none; border-bottom: 1px solid #ccc; border-radius: 0; }
              .answer-section { border: 1px solid #ddd; border-left: 4px solid #999; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>錯題複習卷</h1>
            <p>
              <strong>姓名：</strong>${result.studentName} &nbsp;&nbsp; 
              <strong>單元：</strong>${result.unit} &nbsp;&nbsp; 
              <strong>得分：</strong>${result.score}
            </p>
            <p style="font-size: 0.8em; color: #666;">列印時間：${new Date().toLocaleString()}</p>
          </div>

          ${result.mistakes.map((m, idx) => `
            <div class="question">
              <div class="q-content">
                ${idx + 1}. ${m.content}
              </div>
              ${m.imageUrl ? `<img src="${m.imageUrl}" alt="題目附圖" />` : ''}
              <div class="options">
                ${m.options.map((opt, i) => `
                  <div class="option">
                    (${['A','B','C','D'][i]}) ${opt}
                  </div>
                `).join('')}
              </div>
              <div class="answer-section">
                <div>
                    <span>你的答案：${m.studentAnswerIndex !== undefined ? ['A','B','C','D'][m.studentAnswerIndex] : '未作答'}</span>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    <span class="correct">正確答案：${['A','B','C','D'][m.correctIndex]}</span>
                </div>
                ${m.rationale ? `
                    <div class="rationale">
                        <span class="rationale-label">【詳解】</span>${m.rationale}
                    </div>
                ` : ''}
              </div>
            </div>
          `).join('')}

          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #2563eb; color: white; border: none; border-radius: 5px;">列印此頁</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newQuestion.content || newQuestion.options.some(opt => !opt) || !newQuestion.unit) {
      alert("請填寫完整內容（含單元名稱）");
      return;
    }
    
    try {
      if (editingId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', editingId), {
              ...newQuestion,
              updatedAt: serverTimestamp() 
          });
          alert("題目已更新！");
      } else {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), {
            ...newQuestion,
            createdAt: serverTimestamp(),
            createdBy: userId
          });
          alert("題目已新增！");
      }
      
      setNewQuestion({ 
          subject: '數學',
          volume: '第一冊',
          unit: '', 
          content: '', 
          options: ['', '', '', ''], 
          correctIndex: 0, 
          imageUrl: '',
          rationale: ''
      });
      setEditingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab('list');
    } catch (err) {
      console.error("Submit failed", err);
      alert("操作失敗，可能是圖片過大，請嘗試更小的圖片");
    }
  };

  const cancelEdit = () => {
      setEditingId(null);
      setNewQuestion({ 
        subject: '數學',
        volume: '第一冊',
        unit: '', 
        content: '', 
        options: ['', '', '', ''], 
        correctIndex: 0, 
        imageUrl: '',
        rationale: ''
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (timestamp) => {
      if (!timestamp) return '剛剛';
      const date = new Date(timestamp.seconds * 1000);
      return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5" /> 後台管理
        </h2>
        
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                {Number(thresholdInput) > 0 ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                詳解門檻:
            </span>
            <input 
                type="number" 
                min="0" 
                max="100"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-12 text-center text-sm border rounded p-1 outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400">分</span>
            <button 
                onClick={updateThreshold}
                className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
            >
                更新
            </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-md overflow-x-auto max-w-full">
          {[
            { id: 'list', label: '題庫列表' },
            { id: 'add', label: editingId ? '編輯題目' : '新增題目', icon: editingId ? <Pencil className="w-3 h-3 mr-1"/> : <Plus className="w-3 h-3 mr-1"/> },
            { id: 'import', label: '批次匯入' },
            { id: 'results', label: '學生成績', icon: <BarChart3 className="w-3 h-3 mr-1" /> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => {
                  if (tab.id !== 'add' && editingId) cancelEdit(); 
                  setActiveTab(tab.id);
              }}
              className={`flex items-center whitespace-nowrap px-3 py-1 rounded text-xs font-medium transition ${activeTab === tab.id ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 border-b bg-slate-50 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">目前題庫 ({questions.length} 題)</span>
                
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
                        <ArrowDown01 className="w-3 h-3"/>
                        排序：由舊到新
                    </span>
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded transition"
                    >
                        <Download className="w-3 h-3" />
                        匯出
                    </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <button 
                    onClick={() => setSelectedSubject('全部')}
                    className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition ${selectedSubject === '全部' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    全部
                  </button>
                  {SUBJECTS.map(sub => (
                      <button 
                        key={sub}
                        onClick={() => setSelectedSubject(sub)}
                        className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition ${selectedSubject === sub ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                      >
                        {sub}
                      </button>
                  ))}
              </div>
          </div>

          {Object.keys(filteredAndGroupedQuestions).length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">沒有符合條件的題目</div>
          ) : (
            <div className="p-2 space-y-2">
              {Object.entries(filteredAndGroupedQuestions).map(([groupKey, unitQuestions]) => (
                <div key={groupKey} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <div 
                    onClick={() => toggleUnit(groupKey)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      {expandedUnits[groupKey] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <Folder className="w-4 h-4 text-indigo-500 fill-current" />
                      <span className="text-sm">{groupKey}</span>
                      <span className="text-xs font-normal text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-2">
                        {unitQuestions.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 border px-1 rounded">
                        {unitQuestions[0]?.subject || '未分類'}
                    </span>
                  </div>

                  {expandedUnits[groupKey] && (
                    <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
                      {unitQuestions.map((q, idx) => (
                        <div key={q.id} className="p-3 hover:bg-slate-50 flex justify-between items-start group pl-8 relative">
                          <div className="absolute left-4 top-0 bottom-0 border-l border-slate-200 w-4"></div>
                          <div className="absolute left-4 top-5 border-t border-slate-200 w-3"></div>

                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">#{idx + 1}</span>
                              {q.imageUrl && <ImageIcon className="w-3 h-3 text-blue-500" />}
                              {q.rationale && <BookOpenCheck className="w-3 h-3 text-emerald-500" />}
                            </div>
                            <div className="flex gap-2">
                                { /* 這裡會自動隱藏如果沒有圖片 */ }
                                <RobustImage src={q.imageUrl} alt="題目圖" className="w-10 h-10 object-cover rounded border border-slate-200 mt-1" />
                                <h4 className="font-medium text-sm text-slate-800 line-clamp-2 mt-1">{q.content}</h4>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleEdit(q)}
                                className="text-slate-300 hover:text-indigo-500 transition p-2 hover:bg-indigo-50 rounded"
                                title="編輯題目"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(q.id)}
                                className="text-slate-300 hover:text-red-500 transition p-2 hover:bg-red-50 rounded"
                                title="刪除題目"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className={`bg-white p-4 rounded-lg shadow border-t-4 ${editingId ? 'border-amber-500' : 'border-indigo-500'}`}>
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  {editingId ? <Pencil className="w-5 h-5 text-amber-500"/> : <Plus className="w-5 h-5 text-indigo-500"/>}
                  {editingId ? '編輯現有題目' : '新增題目'}
              </h3>
              {editingId && (
                  <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600 underline">
                      取消編輯，返回新增模式
                  </button>
              )}
          </div>
          
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">科目</label>
                    <select 
                        value={newQuestion.subject}
                        onChange={(e) => setNewQuestion({...newQuestion, subject: e.target.value})}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">冊次</label>
                    <select 
                        value={newQuestion.volume}
                        onChange={(e) => setNewQuestion({...newQuestion, volume: e.target.value})}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    >
                        {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">單元/章節名稱</label>
              <input 
                type="text" 
                value={newQuestion.unit}
                onChange={(e) => setNewQuestion({...newQuestion, unit: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                placeholder="例如：3-1 根式運算"
              />
            </div>
            <div>
              <textarea 
                value={newQuestion.content}
                onChange={(e) => setNewQuestion({...newQuestion, content: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20"
                placeholder="題目內容..."
              />
            </div>
            
            <div className="border border-slate-200 rounded p-3 bg-slate-50">
                <label className="text-xs font-bold text-slate-500 block mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3"/> 題目附圖 (二選一)
                </label>
                
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newQuestion.imageUrl}
                            onChange={(e) => setNewQuestion({...newQuestion, imageUrl: e.target.value})}
                            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none bg-white"
                            placeholder="方法A: 貼上圖片網址..."
                        />
                    </div>
                    
                    <div className="relative">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <button type="button" className={`w-full border-2 border-dashed border-slate-300 rounded py-2 text-sm text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-100 transition ${isUploading ? 'bg-slate-100 cursor-wait' : 'bg-white'}`}>
                            {isUploading ? (
                                <>
                                    <CloudLightning className="w-4 h-4 animate-bounce text-indigo-500"/>
                                    正在上傳雲端 (Firebase Storage)...
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-4 h-4"/>
                                    方法B: 點擊上傳電腦圖片 (自動取得網址)
                                </>
                            )}
                        </button>
                    </div>

                    {newQuestion.imageUrl && (
                        <div className="mt-2 text-center">
                            <span className="text-xs text-slate-400 block mb-1">圖片預覽:</span>
                            <img src={newQuestion.imageUrl} alt="預覽" className="max-h-32 mx-auto border rounded" />
                        </div>
                    )}
                </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1 flex items-center gap-1">
                  <BookOpenCheck className="w-3 h-3" />
                  詳解 (選填)
              </label>
              <textarea 
                value={newQuestion.rationale}
                onChange={(e) => setNewQuestion({...newQuestion, rationale: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none h-16"
                placeholder="輸入詳解..."
              />
            </div>

            <div className="space-y-2">
              {newQuestion.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="correctIndex" 
                    checked={newQuestion.correctIndex === idx}
                    onChange={() => setNewQuestion({...newQuestion, correctIndex: idx})}
                    className="w-3 h-3 accent-indigo-600 cursor-pointer"
                  />
                  <input 
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...newQuestion.options];
                      newOptions[idx] = e.target.value;
                      setNewQuestion({...newQuestion, options: newOptions});
                    }}
                    className={`flex-1 border rounded px-2 py-1 text-sm outline-none ${newQuestion.correctIndex === idx ? 'border-green-500 bg-green-50' : 'border-slate-300'}`}
                    placeholder={`選項 ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
            <button 
                type="submit" 
                className={`w-full font-bold py-2 rounded text-sm transition ${editingId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                disabled={isUploading}
            >
              {editingId ? '更新題目' : '儲存新增'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'import' && <BulkImport userId={userId} />}

      {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">最新繳交紀錄</span>
                  <span className="text-xs text-slate-400">共 {results.length} 筆</span>
              </div>
              {results.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">目前還沒有學生成績</div>
              ) : (
                  <div className="p-2 space-y-2">
                      {Object.entries(resultsByUnit).map(([unit, unitResults]) => (
                          <div key={unit} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              {/* 成績資料夾標題 */}
                              <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition">
                                  <div 
                                    className="flex items-center gap-2 font-bold text-slate-700 flex-1"
                                    onClick={() => toggleResultUnit(unit)}
                                  >
                                      {expandedResultUnits[unit] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                      <Folder className="w-4 h-4 text-emerald-600 fill-current" />
                                      <span className="text-sm">{unit}</span>
                                      <span className="text-xs font-normal text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-2">
                                          {unitResults.length} 筆
                                      </span>
                                  </div>
                                  
                                  {/* 資料夾刪除按鈕 */}
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteResultFolder(unit, unitResults);
                                    }}
                                    className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                    title={`清空 ${unit} 的所有成績`}
                                  >
                                      <FolderX className="w-4 h-4" />
                                  </button>
                              </div>

                              {/* 展開的成績列表 */}
                              {expandedResultUnits[unit] && (
                                  <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
                                      {unitResults.map((r) => (
                                          <div key={r.id} className="p-3 flex items-center justify-between hover:bg-slate-50 pl-8 relative group">
                                              <div className="absolute left-4 top-0 bottom-0 border-l border-slate-200 w-4"></div>
                                              <div className="absolute left-4 top-5 border-t border-slate-200 w-3"></div>
                                              
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ${r.score >= 60 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                      {r.score}
                                                  </div>
                                                  <div>
                                                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                          {r.studentName}
                                                          <span className="text-[10px] font-normal text-white bg-slate-400 px-1.5 rounded-full">
                                                              第 {r.attempt || 1} 次
                                                          </span>
                                                      </div>
                                                      <div className="text-xs text-slate-500">
                                                          答對 {r.correctCount}/{r.totalQuestions} • {formatTime(r.submittedAt)}
                                                      </div>
                                                  </div>
                                              </div>
                                              
                                              <div className="flex items-center gap-1">
                                                  {/* 錯題列印按鈕 */}
                                                  <button 
                                                      onClick={() => handlePrintMistakes(r)}
                                                      className="text-slate-300 hover:text-indigo-500 transition p-2 hover:bg-indigo-50 rounded"
                                                      title="列印錯題卷"
                                                  >
                                                      <Printer className="w-4 h-4" />
                                                  </button>

                                                  {/* 單筆刪除按鈕 */}
                                                  <button 
                                                      onClick={() => handleDeleteResult(r.id)}
                                                      className="text-slate-300 hover:text-red-500 transition p-2 hover:bg-red-50 rounded"
                                                      title="刪除此筆紀錄"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
}

function BulkImport({ userId }) {
  const [text, setText] = useState('');
  const [importSubject, setImportSubject] = useState('數學');
  const [importVolume, setImportVolume] = useState('第一冊');
  const [unit, setUnit] = useState('匯入題庫');
  const [preview, setPreview] = useState([]);
  
  const handleParse = () => {
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = [];
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 6) {
        parsed.push({
          content: parts[0].trim(),
          options: [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()],
          correctIndex: parseInt(parts[5].trim()) - 1,
          unit: unit,
          subject: importSubject,
          volume: importVolume, 
          imageUrl: parts[6] ? parts[6].trim() : '',
          rationale: parts[7] ? parts[7].trim() : '' // 支援解析詳解
        });
      }
    });
    if (parsed.length === 0) alert("格式錯誤");
    setPreview(parsed);
  };

  const handleConfirmImport = async () => {
    if (preview.length === 0) return;
    
    try {
      const baseTime = Date.now();
      
      for (let i = 0; i < preview.length; i++) {
        const q = preview[i];
        const timestamp = new Date(baseTime + i * 100);

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), {
          ...q,
          createdAt: timestamp, 
          createdBy: userId
        });
      }
      alert("匯入成功！");
      setText('');
      setPreview([]);
    } catch (err) {
      console.error(err);
      alert("匯入發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4">
      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
        格式：題目 | 選項1 | 選項2 | 選項3 | 選項4 | 答案(1-4) | 圖片(選填) | 詳解(選填)
      </div>
      
      <div className="flex gap-2">
          <select 
            value={importSubject}
            onChange={(e) => setImportSubject(e.target.value)}
            className="border border-slate-300 rounded px-2 py-2 text-sm w-24"
          >
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            value={importVolume}
            onChange={(e) => setImportVolume(e.target.value)}
            className="border border-slate-300 rounded px-2 py-2 text-sm w-24"
          >
            {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <input 
            type="text" 
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="單元名稱 (例如: 3-1)"
          />
      </div>

      <textarea 
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-32 border border-slate-300 rounded p-2 text-xs font-mono"
        placeholder="題目 | A | B | C | D | 1 | (url) | (詳解)"
      />
      <div className="flex gap-2">
        <button onClick={handleParse} className="flex-1 bg-slate-600 text-white rounded py-2 text-sm">預覽</button>
        {preview.length > 0 && (
          <button onClick={handleConfirmImport} className="flex-1 bg-emerald-600 text-white rounded py-2 text-sm">
            依序匯入 {preview.length} 題
          </button>
        )}
      </div>
    </div>
  );
}

// --- 頁面: 學生前台 ---
function StudentDashboard({ questions, globalSettings }) {
  const [mode, setMode] = useState('setup'); // 'setup', 'quiz', 'result', 'history', 'history_detail'
  const [selectedSubject, setSelectedSubject] = useState('數學'); 
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [studentName, setStudentName] = useState(''); 
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState(1); 
  const [isImproved, setIsImproved] = useState(false); 
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null); // 用於儲存要檢視的歷史紀錄

  const [allResults, setAllResults] = useState([]);
  useEffect(() => {
      const q = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results');
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => doc.data());
          setAllResults(docs);
      }, (error) => {
          console.error("Error fetching results:", error);
      });
      return () => unsubscribe();
  }, []);

  const questionsInSubject = useMemo(() => {
      return questions.filter(q => (q.subject || '數學') === selectedSubject);
  }, [questions, selectedSubject]);

  const units = useMemo(() => {
      const unitSet = new Set();
      questionsInSubject.forEach(q => {
          const vol = q.volume || '未分類';
          const u = q.unit || '一般';
          unitSet.add(`${vol} | ${u}`);
      });
      return Array.from(unitSet).sort();
  }, [questionsInSubject]);

  const filteredQuestions = useMemo(() => {
    if (selectedUnit === 'all') return questionsInSubject;
    const [vol, u] = selectedUnit.split(' | ');
    return questionsInSubject.filter(q => 
        (q.volume || '未分類') === vol && (q.unit || '一般') === u
    );
  }, [questionsInSubject, selectedUnit]);

  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    setQuestionCount(filteredQuestions.length);
  }, [filteredQuestions.length]);

  const startQuiz = () => {
    if (!studentName.trim()) {
        alert("請先輸入您的姓名或座號！");
        return;
    }
    if (filteredQuestions.length === 0) return alert("無題目");
    
    // Shuffle filtered questions
    const selected = [...filteredQuestions].sort(() => 0.5 - Math.random()).slice(0, questionCount);
    const shuffledQuestions = selected.map(q => shuffleQuestionOptions(q));

    setQuizQuestions(shuffledQuestions);
    setUserAnswers({});
    setMode('quiz');
  };

  const handleRetryMistakes = () => {
    const wrongQuestions = quizQuestions.filter(q => userAnswers[q.id] !== q.correctIndex);
    if (wrongQuestions.length === 0) return;

    const reshuffledMistakes = wrongQuestions.map(q => shuffleQuestionOptions(q));
    
    setQuizQuestions(reshuffledMistakes);
    setUserAnswers({});
    setScore(0);
    setMode('quiz');
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    const mistakes = []; // 儲存錯題

    quizQuestions.forEach(q => {
      const studentAns = userAnswers[q.id];
      const isCorrect = studentAns === q.correctIndex;
      
      if (isCorrect) {
        correctCount++;
      } else {
        // 記錄錯題詳情 (包含詳解)
        mistakes.push({
          id: q.id,
          content: q.content,
          options: q.options,
          correctIndex: q.correctIndex,
          studentAnswerIndex: studentAns, 
          imageUrl: q.imageUrl || '',
          rationale: q.rationale || ''
        });
      }
    });

    const finalScore = Math.round((correctCount / quizQuestions.length) * 100);
    setScore(finalScore);
    
    const currentUnitName = selectedUnit === 'all' ? `${selectedSubject}總測驗` : selectedUnit;
    const myHistory = allResults.filter(r => r.studentName === studentName && r.unit === currentUnitName);
    const attemptNumber = myHistory.length + 1;
    setCurrentAttempt(attemptNumber);

    const maxScore = myHistory.reduce((max, r) => Math.max(max, r.score), 0);
    setIsImproved(finalScore > maxScore && myHistory.length > 0);

    setMode('result');

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results'), {
            studentName: studentName,
            score: finalScore,
            totalQuestions: quizQuestions.length,
            correctCount: correctCount,
            unit: currentUnitName,
            attempt: attemptNumber, 
            submittedAt: serverTimestamp(),
            mistakes: mistakes // 儲存錯題資料
        });
    } catch (err) {
        console.error("Upload score failed", err);
    }
  };

  // 學生歷史紀錄資料
  const studentHistory = useMemo(() => {
    if (!studentName.trim()) return [];
    return allResults.filter(r => r.studentName === studentName).sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA; // 最新在最上面
    });
  }, [allResults, studentName]);

  const viewHistoryDetail = (item) => {
      setSelectedHistoryItem(item);
      setMode('history_detail');
  };

  // 渲染：試卷檢討 (錯題詳情)
  if (mode === 'history_detail' && selectedHistoryItem) {
      return (
          <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <button onClick={() => setMode('history')} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-bold">
                      <ChevronLeft className="w-4 h-4" /> 返回列表
                  </button>
                  <h3 className="font-bold text-slate-800">試卷檢討</h3>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm space-y-1">
                  <div className="flex justify-between">
                      <span className="text-slate-500">測驗單元:</span>
                      <span className="font-bold">{selectedHistoryItem.unit}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">得分:</span>
                      <span className={`font-bold ${selectedHistoryItem.score >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {selectedHistoryItem.score} 分
                      </span>
                  </div>
              </div>

              {selectedHistoryItem.mistakes && selectedHistoryItem.mistakes.length > 0 ? (
                  <div className="space-y-4">
                      {selectedHistoryItem.mistakes.map((m, idx) => (
                          <div key={idx} className="border border-red-100 rounded-lg p-3 bg-red-50/30">
                              <div className="font-medium text-slate-800 mb-2 flex gap-2">
                                  <span className="text-red-500 font-bold">X</span>
                                  {m.content}
                              </div>
                              {m.imageUrl && (
                                  <RobustImage src={m.imageUrl} alt="題目附圖" className="max-w-full max-h-40 rounded border border-slate-200 object-contain mb-2" />
                              )}
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mb-2">
                                  {m.options.map((opt, i) => (
                                      <div key={i} className={`p-1.5 rounded border ${i === m.correctIndex ? 'bg-emerald-100 border-emerald-300' : (i === m.studentAnswerIndex ? 'bg-red-100 border-red-300' : 'bg-white border-slate-200')}`}>
                                          {['A','B','C','D'][i]}. {opt}
                                      </div>
                                  ))}
                              </div>

                              <div className="text-xs flex items-center gap-4 border-t border-red-100 pt-2 mt-2">
                                  <span className="text-red-600">你的答案: {m.studentAnswerIndex !== undefined ? ['A','B','C','D'][m.studentAnswerIndex] : '未作答'}</span>
                                  <span className="text-emerald-600 font-bold">正確答案: {['A','B','C','D'][m.correctIndex]}</span>
                              </div>
                              
                              {m.rationale && (
                                  <div className="mt-2 text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                                      <span className="font-bold text-amber-500">【詳解】</span> {m.rationale}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-8">
                      <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                      <p className="text-slate-800 font-bold">恭喜滿分！</p>
                      <p className="text-xs text-slate-500">這份試卷沒有錯題。</p>
                  </div>
              )}
          </div>
      );
  }

  // 渲染：歷史列表
  if (mode === 'history') {
      return (
          <div className="bg-white rounded-lg shadow-md p-4 min-h-[300px]">
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <button onClick={() => setMode('setup')} className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-bold">
                      <ChevronLeft className="w-4 h-4" /> 返回
                  </button>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" /> 
                      {studentName} 的測驗紀錄
                  </h3>
              </div>

              {studentHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <ScrollText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>尚無測驗紀錄</p>
                  </div>
              ) : (
                  <div className="space-y-2">
                      {studentHistory.map((item, idx) => (
                          <div 
                              key={idx} 
                              onClick={() => viewHistoryDetail(item)}
                              className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition flex justify-between items-center group"
                          >
                              <div className="flex-1">
                                  <div className="font-bold text-slate-700 text-sm mb-1">{item.unit}</div>
                                  <div className="text-xs text-slate-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {item.submittedAt ? new Date(item.submittedAt.seconds * 1000).toLocaleString() : '剛剛'}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className={`text-lg font-bold ${item.score >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {item.score}
                                  </div>
                                  <div className="text-[10px] text-slate-400">分</div>
                              </div>
                              <div className="ml-3 opacity-0 group-hover:opacity-100 transition text-slate-400">
                                  <ChevronRight className="w-5 h-5" />
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  }

  if (mode === 'setup') {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-indigo-500">
        <h2 className="text-xl font-bold mb-4 text-slate-800">測驗設定</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">姓名 / 座號</label>
            <input 
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full border rounded p-2 text-sm border-indigo-200 focus:border-indigo-500 outline-none bg-indigo-50/30"
                placeholder="請輸入您的名字..."
            />
            {/* 新增歷史紀錄按鈕 */}
            {studentName.trim() && (
                <button 
                    onClick={() => setMode('history')}
                    className="mt-2 w-full text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 py-1.5 rounded border border-dashed border-slate-300 flex items-center justify-center gap-1 transition"
                >
                    <ScrollText className="w-3 h-3" />
                    查看我的歷史成績 ({studentHistory.length})
                </button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">選擇科目</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {SUBJECTS.map(s => (
                    <button 
                        key={s}
                        onClick={() => setSelectedSubject(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition border ${selectedSubject === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                        {s}
                    </button>
                ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">選擇範圍 (冊次 | 單元)</label>
            <select 
              value={selectedUnit} 
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            >
              <option value="all">全部單元 (混合)</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              題數: <span className="font-bold text-indigo-600">{questionCount}</span> 題
            </label>
            <input 
              type="range" 
              min="1" 
              max={Math.max(1, filteredQuestions.length)} 
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>1題</span>
              <span>{Math.max(1, filteredQuestions.length)}題 (全)</span>
            </div>
          </div>

          <button onClick={startQuiz} disabled={questions.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition text-sm flex justify-center items-center gap-2">
            <Shuffle className="w-4 h-4"/> 開始測驗 (選項自動洗牌)
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'quiz') {
    const progress = (Object.keys(userAnswers).length / quizQuestions.length) * 100;
    return (
      <div className="space-y-4 pb-8">
        <div className="bg-slate-200 h-1.5 rounded-full sticky top-0 z-10">
          <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
        </div>
        {quizQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
            <div className="mb-4">
                <h3 className="text-base font-bold text-slate-800 mb-2 leading-relaxed">
                <span className="text-indigo-500 mr-2">{idx + 1}.</span>{q.content}
                </h3>
                {q.imageUrl && (
                    <div className="mb-3">
                        <RobustImage src={q.imageUrl} alt="題目附圖" className="max-w-full max-h-60 rounded border border-slate-200 object-contain mx-auto sm:mx-0" />
                    </div>
                )}
            </div>
            <div className="space-y-2">
              {q.options.map((opt, optIdx) => (
                <label key={optIdx} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${userAnswers[q.id] === optIdx ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                  <input 
                    type="radio" 
                    name={`q-${q.id}`} 
                    className="accent-indigo-600"
                    checked={userAnswers[q.id] === optIdx}
                    onChange={() => setUserAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <button 
          onClick={handleSubmit}
          disabled={Object.keys(userAnswers).length !== quizQuestions.length}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg shadow transition text-sm"
        >
          交卷
        </button>
      </div>
    );
  }

  if (mode === 'result') {
    const canShowAnswers = score >= (globalSettings?.revealThreshold || 0);

    return (
      <div>
        <div className="bg-white p-6 rounded-xl shadow-md mb-4 text-center relative overflow-hidden">
          {isImproved && (
              <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                  <TrendingUp className="w-4 h-4" /> 
                  進步了！
              </div>
          )}
          
          <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold mb-2">
              <History className="w-3 h-3" />
              第 {currentAttempt} 次測驗
          </div>

          <h2 className="text-4xl font-black mb-2 text-indigo-600">{score} <span className="text-lg text-slate-400">分</span></h2>
          <div className="text-slate-500 text-sm mb-4">考生：{studentName}</div>
          
          {!canShowAnswers && (
              <div className="mb-4 p-3 bg-amber-50 text-amber-700 text-sm rounded-lg flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>未達顯示詳解標準 ({globalSettings.revealThreshold}分)，請再接再厲！</span>
              </div>
          )}

          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => setMode('setup')} 
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              重新開始
            </button>
            {score < 100 && (
              <button 
                onClick={handleRetryMistakes} 
                className="text-sm bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-2 rounded flex items-center gap-1 font-bold"
              >
                <Shuffle className="w-3 h-3" />
                錯題重測
              </button>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {quizQuestions.map(q => {
            const isCorrect = userAnswers[q.id] === q.correctIndex;
            return (
              <div key={q.id} className={`p-4 rounded-lg border-l-4 bg-white text-sm ${isCorrect ? 'border-emerald-500' : 'border-red-500'}`}>
                <div className="font-bold text-slate-800 mb-2">{q.content}</div>
                {q.imageUrl && <RobustImage src={q.imageUrl} alt="題目附圖" className="max-w-full max-h-40 rounded border border-slate-200 object-contain mb-2" />}
                
                {!isCorrect && <div className="text-red-600">你的: {q.options[userAnswers[q.id]]}</div>}
                
                {canShowAnswers ? (
                    <div className="space-y-2">
                        <div className="text-emerald-600">正解: {q.options[q.correctIndex]}</div>
                        {q.rationale && (
                            <div className="text-slate-500 text-xs border-t border-slate-100 pt-2 mt-2">
                                <span className="font-bold text-amber-500">【詳解】</span>
                                {q.rationale}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-slate-400 italic text-xs flex items-center gap-1 mt-1">
                        <Lock className="w-3 h-3" /> 詳解已隱藏
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}