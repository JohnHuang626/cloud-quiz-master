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
  updateDoc
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
  Plus, 
  Trash2, 
  Settings, 
  User, 
  GraduationCap,
  FileText,
  RefreshCcw,
  UploadCloud,
  Columns,
  Maximize,
  Image as ImageIcon, 
  BarChart3, 
  Clock,
  RotateCcw,
  AlertCircle,
  Lock, 
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
  ArrowDown01,
  Printer,
  BookOpenCheck,
  CloudLightning,
  Mail,
  ScrollText,
  Trophy,
  MonitorPlay,
  Medal,
  Check,
  UserCheck,
  XCircle,
  KeyRound,
  X
} from 'lucide-react';

// --- 錯誤邊界元件 (Error Boundary) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 min-h-screen flex flex-col items-center justify-center text-red-900 font-sans text-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200 text-center max-w-sm">
            <AlertCircle className="w-12 h-12 mb-4 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold mb-2">應用程式遇到問題</h1>
            <p className="mb-4 text-slate-600">這通常是因為瀏覽器的翻譯功能干擾了程式運作。</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-bold shadow hover:bg-red-700 transition"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Firebase 初始化 ---
const firebaseConfig = {
  apiKey: "AIzaSyCCy_dv6TY4cKHlXKMNYDBOl4HFgjrY_NU",
  authDomain: "quiz-master-final-v2.firebaseapp.com",
  projectId: "quiz-master-final-v2",
  storageBucket: "quiz-master-final-v2.firebasestorage.app",
  messagingSenderId: "867862608300",
  appId: "1:867862608300:web:f6d23736cccdfec6ab6209"
};

let app, auth, db, storage;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const appId = 'cloud-quiz-master-v1'; 

const SUBJECTS = ["國文", "英語", "數學", "自然", "地理", "歷史", "公民", "其他"];
const VOLUMES = ["第一冊", "第二冊", "第三冊", "第四冊", "第五冊", "第六冊", "總複習", "不分冊"];

const LoadingSpinner = () => (
  <div className="flex flex-col justify-center items-center h-[50dvh] text-indigo-600">
    <RefreshCcw className="animate-spin w-10 h-10 mb-2" />
    <span className="text-sm font-bold animate-pulse">系統載入中...</span>
  </div>
);

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

// --- 主應用程式 ---
function QuizApp() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ revealThreshold: 60 });
  const [loading, setLoading] = useState(true);
  const [isSplitScreen, setIsSplitScreen] = useState(false); 
  const [initError, setInitError] = useState(null);
  const [currentView, setCurrentView] = useState('landing');

  const leftWindowIdRef = useRef(`win-${Math.random().toString(36).substr(2, 5)}`);
  const rightWindowIdRef = useRef(`win-${Math.random().toString(36).substr(2, 5)}`);

  useEffect(() => {
    if (!auth) {
      setInitError("Firebase 初始化失敗，請檢查網路。");
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (u) {
            setCurrentView('dashboard');
        } else {
            setCurrentView('landing');
        }
        setLoading(false);
      }, (error) => {
        console.error("Auth Error:", error);
        setInitError("驗證失敗，請重整。");
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setInitError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    try {
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
    } catch (err) {
      console.error("Firestore Error:", err);
    }
  }, [user]);

  const goHome = () => setCurrentView('landing');
  const enterDashboard = () => setCurrentView('dashboard');

  if (loading) return <LoadingSpinner />;

  if (initError) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 h-[100dvh] flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h3 className="font-bold text-lg">系統錯誤</h3>
        <p>{initError}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">重新載入</button>
      </div>
    );
  }

  const showLanding = !user || currentView === 'landing';

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800 font-sans flex flex-col notranslate" translate="no">
      <header className="bg-indigo-600 text-white shadow-lg shrink-0 z-20 relative">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity active:scale-95"
            onClick={goHome}
          >
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wide hidden sm:block">雲端測驗大師 v3.8</h1>
            <h1 className="text-xl font-bold tracking-wide sm:hidden">測驗大師</h1>
          </div>
          <div className="flex items-center gap-2">
            {!showLanding && !user?.isAnonymous && (
                <button 
                onClick={() => setIsSplitScreen(!isSplitScreen)}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-2 rounded text-sm transition border border-white/30 text-white font-bold shadow-sm"
                >
                {isSplitScreen ? <Maximize className="w-4 h-4"/> : <Columns className="w-4 h-4"/>}
                <span className="hidden sm:inline">{isSplitScreen ? '單視窗' : '雙視窗測試'}</span>
                <span className="sm:hidden text-xs">{isSplitScreen ? '單視窗' : '雙視窗'}</span>
                </button>
            )}
            {showLanding && user && (
                <div className="text-xs bg-indigo-700 px-2 py-1 rounded flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    {user.isAnonymous ? '學生' : '老師'}
                </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {showLanding ? (
            <div className="h-full overflow-y-auto">
                <LandingPage 
                    questionCount={questions.length} 
                    currentUser={user} 
                    onEnterDashboard={enterDashboard}
                />
            </div>
        ) : (
            <div className={`h-full relative ${isSplitScreen ? 'flex divide-x-4 divide-slate-300' : ''}`}>
                <div className={`bg-slate-50 ${isSplitScreen ? 'w-1/2' : 'w-full'} overflow-y-auto h-full scroll-smooth`}>
                <QuizSession 
                    key={leftWindowIdRef.current} 
                    windowId={leftWindowIdRef.current} 
                    questions={questions} 
                    globalSettings={globalSettings}
                    user={user}
                    label={isSplitScreen ? "左側視窗 (建議: 老師)" : ""} 
                />
                </div>
                {isSplitScreen && (
                <div className="w-1/2 bg-slate-100 overflow-y-auto h-full shadow-inner border-l border-slate-300 scroll-smooth">
                    <QuizSession 
                    key={rightWindowIdRef.current}
                    windowId={rightWindowIdRef.current}
                    questions={questions} 
                    globalSettings={globalSettings}
                    user={user}
                    label="右側視窗 (模擬學生視角)" 
                    roleOverride="student" 
                    />
                </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QuizApp />
    </ErrorBoundary>
  );
}

function QuizSession({ questions, globalSettings, user, label, roleOverride, windowId }) {
  if (!user && roleOverride === 'student') {
    return (
        <div className="px-4 py-6 max-w-5xl mx-auto relative flex flex-col items-center justify-center h-full text-slate-400 min-h-[50dvh]">
            {label && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="text-[10px] font-bold text-slate-500 bg-white/90 border border-slate-200 px-2 py-1 rounded shadow-sm">
                        {label}
                    </div>
                </div>
            )}
            <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <MonitorPlay className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <h3 className="font-bold text-base mb-2 text-slate-600">等待登入</h3>
                <p className="text-xs">請在 <span className="font-bold text-indigo-600">左側視窗</span> 登入帳號</p>
            </div>
        </div>
    );
  }

  const isTeacher = user && !user.isAnonymous && roleOverride !== 'student';
  const isStudent = user && (user.isAnonymous || roleOverride === 'student');

  return (
    <div className="px-3 py-4 max-w-3xl mx-auto relative pb-20"> 
      {label && (
        <div className="flex justify-end mb-2 sticky top-0 z-10 pointer-events-none">
           <div className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm backdrop-blur border inline-flex items-center gap-1 ${roleOverride === 'student' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white/95 text-slate-500 border-slate-200'}`}>
             {roleOverride === 'student' && <UserCheck className="w-3 h-3" />}
             {label}
           </div>
        </div>
      )}
       
      {user && (
        <div className="flex justify-between items-center mb-4 bg-white p-2 rounded border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-500">
                身分: <span className={`font-bold ${isTeacher ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {isTeacher ? '👨‍🏫 老師' : '👨‍🎓 學生'}
                </span>
            </div>
            {!roleOverride && (
              <button 
                onClick={() => signOut(auth)}
                className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1 px-2 py-1 hover:bg-slate-50 rounded"
              >
                <LogOut className="w-3 h-3" />
                登出
              </button>
            )}
        </div>
      )}

      {roleOverride === 'student' && user && !user.isAnonymous && (
         <div className="mb-4 bg-blue-50 border border-blue-200 p-2 rounded text-xs text-blue-800 flex items-start gap-2">
            <MonitorPlay className="w-4 h-4 shrink-0 mt-0.5" />
            <span>模擬預覽中：您的操作將被視為獨立的學生，紀錄不會影響您的教師帳號設定。</span>
         </div>
      )}

      {!user && <LandingPage questionCount={questions.length} />}
      {isTeacher && <TeacherDashboard questions={questions} globalSettings={globalSettings} userId={user.uid} windowId={windowId} />}
      {isStudent && <StudentDashboard questions={questions} globalSettings={globalSettings} windowId={windowId} />}
    </div>
  );
}

function LandingPage({ questionCount, currentUser, onEnterDashboard }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleStudentClick = async () => {
      if (currentUser && currentUser.isAnonymous) {
          onEnterDashboard();
      } else {
          try {
              setIsLoggingIn(true);
              if (currentUser) await signOut(auth);
              await signInAnonymously(auth);
          } catch (error) {
              console.error("Student login failed", error);
              alert("登入失敗: " + error.message);
              setIsLoggingIn(false);
          }
      }
  };

  const handleTeacherClick = () => {
      if (currentUser && !currentUser.isAnonymous) {
          onEnterDashboard();
      } else {
          setShowLoginModal(true);
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
    <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-slate-800">歡迎使用測驗系統</h2>
        <p className="text-sm text-slate-500">目前題庫: <span className="font-bold text-indigo-600">{questionCount}</span> 題</p>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-sm px-4">
        <button 
          onClick={handleStudentClick}
          disabled={isLoggingIn}
          className="group flex items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all hover:border-indigo-300 hover:shadow-md"
        >
          <div className="bg-indigo-100 p-3 rounded-full mr-4">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-slate-800 text-lg">我是學生</h3>
            <p className="text-xs text-gray-400">
                {currentUser && currentUser.isAnonymous ? '已登入，點擊繼續測驗' : '免註冊，直接進入測驗'}
            </p>
          </div>
          {currentUser && currentUser.isAnonymous ? <ArrowDown01 className="w-5 h-5 text-green-500" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
        </button>

        <button 
          onClick={handleTeacherClick}
          disabled={isLoggingIn}
          className="group flex items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all hover:border-emerald-300 hover:shadow-md"
        >
          <div className="bg-emerald-100 p-3 rounded-full mr-4">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-slate-800 text-lg">我是老師</h3>
            <p className="text-xs text-gray-400">
                {currentUser && !currentUser.isAnonymous ? '已登入，點擊進入後台' : '需登入以管理題目'}
            </p>
          </div>
          {currentUser && !currentUser.isAnonymous ? <ArrowDown01 className="w-5 h-5 text-green-500" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
        </button>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xs animate-in zoom-in-95 border border-white/20">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                        <KeyRound className="w-5 h-5 text-emerald-500" />
                        教師登入
                    </h3>
                    <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleTeacherLogin} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1.5 ml-1">Email</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            placeholder="teacher@school.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1.5 ml-1">密碼</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            placeholder="輸入密碼"
                            required
                        />
                    </div>
                     
                    {errorMsg && <p className="text-xs text-red-500 text-center font-bold bg-red-50 p-2 rounded">{errorMsg}</p>}
                    
                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm flex justify-center items-center gap-2 mt-2 transition-colors shadow-sm"
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

function TeacherDashboard({ questions, globalSettings, userId, windowId }) {
  const [activeTab, setActiveTab] = useState('list'); 
  const [selectedSubject, setSelectedSubject] = useState('全部'); 
  const [editingId, setEditingId] = useState(null); 
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingLeaderboard, setViewingLeaderboard] = useState(null); // 目前正在查看排行榜的單元

  const safeWindowId = windowId || `teacher-${Math.random()}`;

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

  // 計算排行榜資料：取每個學生在該單元的最高分
  const getLeaderboardData = (unit) => {
      const unitResults = resultsByUnit[unit] || [];
      const bestScores = {};
      unitResults.forEach(r => {
          if (!bestScores[r.studentName] || r.score > bestScores[r.studentName].score) {
              bestScores[r.studentName] = r;
          }
      });
      return Object.values(bestScores).sort((a, b) => b.score - a.score);
  };

  const toggleUnit = (unit) => setExpandedUnits(p => ({ ...p, [unit]: !p[unit] }));
  const toggleResultUnit = (unit) => setExpandedResultUnits(p => ({ ...p, [unit]: !p[unit] }));

  const updateThreshold = async () => {
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_settings', 'global'), {
              revealThreshold: Number(thresholdInput)
          }, { merge: true });
          alert("設定已更新");
      } catch (err) {
          console.error(err);
      }
  };

  const handleExport = () => {
    if (questions.length === 0) return alert("無題目可匯出");
    const exportText = questions.map(q => {
        const optionsStr = q.options.join(' | ');
        const answer = q.correctIndex + 1;
        const img = q.imageUrl ? ` | ${q.imageUrl}` : '';
        const rat = q.rationale ? ` | ${q.rationale}` : ''; 
        return `${q.content} | ${optionsStr} | ${answer}${img} | ${q.subject} | ${q.volume}${rat}`;
    }).join('\n');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_backup.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定刪除？')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', id));
    }
  };

  const handleDeleteFolder = async (groupKey, items) => {
    if (window.confirm(`確定要刪除「${groupKey}」下所有 ${items.length} 題嗎？`)) {
        try {
            const promises = items.map(item => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', item.id)));
            await Promise.all(promises);
            alert(`已刪除 ${groupKey}`);
        } catch (err) {
            alert("刪除失敗");
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
        alert("上傳失敗");
    } finally {
        setIsUploading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newQuestion.content || newQuestion.options.some(opt => !opt) || !newQuestion.unit) return alert("資料不完整");
    
    try {
      const data = { ...newQuestion, updatedAt: serverTimestamp() };
      if (editingId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', editingId), data);
          alert("更新成功");
      } else {
          data.createdAt = serverTimestamp();
          data.createdBy = userId;
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), data);
          alert("新增成功");
      }
      setNewQuestion({ ...newQuestion, content: '', options: ['','','',''], imageUrl: '', rationale: '' });
      setEditingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab('list');
    } catch (err) {
      alert("操作失敗");
    }
  };

  const handleDeleteResult = async (id) => {
    if (window.confirm('刪除此成績？')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', id));
  };

  const handleDeleteResultFolder = async (unit, items) => {
    if (window.confirm(`清空「${unit}」成績？`)) {
        const promises = items.map(item => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', item.id)));
        await Promise.all(promises);
        alert("已清空");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4" /> 後台管理
        </h2>
        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded border">
            <span className="text-xs">詳解門檻:</span>
            <input 
                type="number" 
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-10 text-center text-xs border rounded"
            />
            <button onClick={updateThreshold} className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">更新</button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-md overflow-x-auto">
          {[
            { id: 'list', label: '列表', icon: <FileText className="w-3 h-3 mr-1"/> },
            { id: 'add', label: editingId ? '編輯' : '新增', icon: <Plus className="w-3 h-3 mr-1"/> },
            { id: 'import', label: '匯入', icon: <UploadCloud className="w-3 h-3 mr-1"/> },
            { id: 'results', label: '成績', icon: <BarChart3 className="w-3 h-3 mr-1" /> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => {
                  if (tab.id !== 'add') { setEditingId(null); }
                  setActiveTab(tab.id);
              }}
              className={`flex items-center whitespace-nowrap px-3 py-1.5 rounded text-xs font-bold transition ${activeTab === tab.id ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-2 border-b bg-slate-50 flex gap-2 overflow-x-auto">
              <button onClick={() => setSelectedSubject('全部')} className={`px-2 py-1 rounded text-xs ${selectedSubject === '全部' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>全部</button>
              {SUBJECTS.map(s => <button key={s} onClick={() => setSelectedSubject(s)} className={`px-2 py-1 rounded text-xs ${selectedSubject === s ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{s}</button>)}
          </div>
          <div className="p-2 space-y-2">
            {Object.entries(filteredAndGroupedQuestions).map(([groupKey, unitQuestions]) => (
                <div key={groupKey} className="border border-slate-200 rounded bg-slate-50">
                    <div className="p-2 flex justify-between items-center cursor-pointer" onClick={() => toggleUnit(groupKey)}>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            {expandedUnits[groupKey] ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                            {groupKey} <span className="text-xs bg-white px-1 border rounded">{unitQuestions.length}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(groupKey, unitQuestions); }} className="text-red-400 hover:text-red-600 p-1"><FolderX className="w-4 h-4"/></button>
                    </div>
                    {expandedUnits[groupKey] && (
                        <div className="bg-white divide-y">
                            {unitQuestions.map((q, idx) => (
                                <div key={q.id} className="p-2 flex justify-between group hover:bg-slate-50">
                                    <div className="flex-1 text-xs">
                                        <span className="text-slate-400 mr-1">#{idx+1}</span>
                                        {q.content.substring(0, 30)}...
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(q)} className="text-blue-400"><Pencil className="w-3 h-3"/></button>
                                        <button onClick={() => handleDelete(q.id)} className="text-red-400"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1">{editingId ? <Pencil className="w-4 h-4"/> : <Plus className="w-4 h-4"/>} {editingId ? '編輯' : '新增'}</h3>
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <select value={newQuestion.subject} onChange={e => setNewQuestion({...newQuestion, subject: e.target.value})} className="border rounded p-1 text-sm">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <select value={newQuestion.volume} onChange={e => setNewQuestion({...newQuestion, volume: e.target.value})} className="border rounded p-1 text-sm">{VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
            <input type="text" value={newQuestion.unit} onChange={e => setNewQuestion({...newQuestion, unit: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="單元名稱 (如: 3-1)" />
            <textarea value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="w-full border rounded p-2 text-sm h-20" placeholder="題目內容" />
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="text-xs w-full" disabled={isUploading}/>
                {newQuestion.imageUrl && <span className="text-xs text-green-500 flex items-center"><CheckCircle className="w-3 h-3"/>圖</span>}
            </div>
            <textarea value={newQuestion.rationale} onChange={e => setNewQuestion({...newQuestion, rationale: e.target.value})} className="w-full border rounded p-2 text-sm h-12" placeholder="詳解 (選填)" />
            {newQuestion.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1">
                    <input type="radio" name={`ans-${safeWindowId}`} checked={newQuestion.correctIndex === idx} onChange={() => setNewQuestion({...newQuestion, correctIndex: idx})} />
                    <input type="text" value={opt} onChange={e => { const n = [...newQuestion.options]; n[idx] = e.target.value; setNewQuestion({...newQuestion, options: n}); }} className="flex-1 border rounded p-1 text-sm" placeholder={`選項 ${idx+1}`} />
                </div>
            ))}
            <button type="submit" disabled={isUploading} className="w-full bg-indigo-600 text-white p-2 rounded text-sm font-bold">{editingId ? '更新' : '新增'}</button>
          </form>
        </div>
      )}

      {activeTab === 'import' && <BulkImport userId={userId} />}

      {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow overflow-hidden p-2 space-y-2">
              {Object.entries(resultsByUnit).map(([unit, unitResults]) => (
                  <div key={unit} className="border rounded bg-slate-50">
                      <div className="p-2 flex justify-between items-center cursor-pointer" onClick={() => toggleResultUnit(unit)}>
                          <span className="text-sm font-bold flex items-center gap-2">
                              {expandedResultUnits[unit] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {unit} ({unitResults.length})
                          </span>
                          <div className="flex gap-2">
                              {/* 🏆 排行榜按鈕 */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setViewingLeaderboard(unit); }} 
                                className="text-xs bg-yellow-400 hover:bg-yellow-500 text-white px-2 py-1 rounded flex items-center gap-1"
                              >
                                  <Trophy className="w-3 h-3" /> 排行榜
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteResultFolder(unit, unitResults); }} className="text-red-400 p-1 hover:bg-red-100 rounded"><FolderX className="w-4 h-4"/></button>
                          </div>
                      </div>
                      {expandedResultUnits[unit] && (
                          <div className="bg-white divide-y">
                              {unitResults.map(r => (
                                  <div key={r.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                                      <div className="text-xs flex-1">
                                          <span className="font-bold text-slate-700">{r.studentName}</span>
                                          <span className="text-slate-400 mx-1">|</span>
                                          <span className={r.score>=60?'text-green-600 font-bold':'text-red-500 font-bold'}>{r.score}分</span>
                                      </div>
                                      <button onClick={() => handleDeleteResult(r.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-3 h-3"/></button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}

      {/* 排行榜 Modal */}
      {viewingLeaderboard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewingLeaderboard(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-300" /> {viewingLeaderboard} 排名</h3>
                      <button onClick={() => setViewingLeaderboard(null)}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                      <div className="divide-y">
                          {getLeaderboardData(viewingLeaderboard).map((student, idx) => (
                              <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                  <div className="flex items-center gap-3">
                                      <div className="w-6 text-center font-bold text-slate-400">
                                          {idx === 0 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto" /> : 
                                           idx === 1 ? <Medal className="w-6 h-6 text-slate-400 mx-auto" /> :
                                           idx === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto" /> :
                                           `#${idx + 1}`}
                                      </div>
                                      <span className="font-bold text-slate-700">{student.studentName}</span>
                                  </div>
                                  <span className={`font-bold ${student.score >= 60 ? 'text-green-600' : 'text-red-500'}`}>{student.score} 分</span>
                              </div>
                          ))}
                          {getLeaderboardData(viewingLeaderboard).length === 0 && <div className="p-4 text-center text-slate-400">尚無成績紀錄</div>}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

function BulkImport({ userId }) {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState('匯入題庫');
  const [preview, setPreview] = useState([]);
  
  const handleParse = () => {
    const parsed = text.split('\n').filter(l => l.trim()).map(line => {
      const p = line.split('|');
      if (p.length >= 6) return { content: p[0].trim(), options: [p[1], p[2], p[3], p[4]].map(s=>s.trim()), correctIndex: parseInt(p[5])-1, unit, subject: '數學', volume: '不分冊', imageUrl: p[6]?.trim()||'', rationale: p[7]?.trim()||'' };
      return null;
    }).filter(Boolean);
    setPreview(parsed);
  };

  const handleImport = async () => {
    const base = Date.now();
    for (let i=0; i<preview.length; i++) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), { ...preview[i], createdAt: new Date(base+i), createdBy: userId });
    }
    alert("匯入完成");
    setPreview([]); setText('');
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-2">
        <input value={unit} onChange={e=>setUnit(e.target.value)} className="border p-1 w-full text-sm" placeholder="單元名稱" />
        <textarea value={text} onChange={e=>setText(e.target.value)} className="border p-1 w-full h-32 text-xs" placeholder="題目|A|B|C|D|1|img|詳解" />
        <div className="flex gap-2">
            <button onClick={handleParse} className="flex-1 bg-gray-500 text-white text-xs py-2 rounded">預覽</button>
            {preview.length > 0 && <button onClick={handleImport} className="flex-1 bg-green-600 text-white text-xs py-2 rounded">確認匯入 {preview.length} 題</button>}
        </div>
    </div>
  );
}

function StudentDashboard({ questions, globalSettings, windowId }) {
  const [mode, setMode] = useState('setup');
  const [selSub, setSelSub] = useState('數學');
  const [selUnit, setSelUnit] = useState('all');
  const [name, setName] = useState('');
  const [quizQs, setQuizQs] = useState([]);
  const [ans, setAns] = useState({});
  const [score, setScore] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [isImproved, setIsImproved] = useState(false);
  
  const safeId = windowId || `student-${Math.random()}`;

  const filteredQs = useMemo(() => {
      return questions.filter(q => q.subject === selSub && (selUnit === 'all' || `${q.volume}|${q.unit}` === selUnit));
  }, [questions, selSub, selUnit]);

  // FIX: String cast added
  const units = useMemo(() => [...new Set(questions.filter(q => q.subject === selSub).map(q => `${q.volume}|${q.unit}`))].sort(), [questions, selSub]);

  const start = () => {
      if (!name) return alert("請輸入姓名");
      if (filteredQs.length === 0) return alert("無題目");
      setQuizQs(filteredQs.sort(() => 0.5 - Math.random()).map(shuffleQuestionOptions));
      setAns({});
      setMode('quiz');
  };

  const submit = async () => {
      let correct = 0;
      const mistakes = [];
      quizQs.forEach(q => {
          const isRight = ans[q.id] === q.correctIndex;
          if (isRight) correct++;
          else mistakes.push({ ...q, studentAnswerIndex: ans[q.id] });
      });
      const finalScore = Math.round((correct / quizQs.length) * 100);
      setScore(finalScore);
      const currentUnitName = selUnit === 'all' ? `${selSub}總測驗` : selUnit;
      
      // 這裡不需再計算排名，只負責上傳
      setMode('result');
      
      // 若需要知道是否進步，這裡仍需查詢自己的歷史紀錄 (省略以簡化，或可單獨查詢)
      setIsImproved(false); // 暫時關閉進步提示，或需額外 fetch 個人紀錄

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results'), {
          studentName: name, score: finalScore, unit: currentUnitName,
          submittedAt: serverTimestamp(), mistakes, totalQuestions: quizQs.length, correctCount: correct
      });
  };

  if (mode === 'setup') return (
      <div className="bg-white p-6 rounded-xl shadow-md space-y-4 border-t-4 border-indigo-500">
          <h2 className="font-bold text-lg">開始測驗</h2>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded p-2" placeholder="姓名" />
          <div className="flex gap-2 overflow-x-auto pb-1">
              {SUBJECTS.map(s => <button key={s} onClick={()=>setSelSub(s)} className={`px-3 py-1 rounded-full text-sm border whitespace-nowrap ${selSub===s?'bg-indigo-600 text-white':'bg-white'}`}>{s}</button>)}
          </div>
          <select value={selUnit} onChange={e=>setSelUnit(e.target.value)} className="w-full border rounded p-2">
              <option value="all">全部範圍</option>
              {units.map(u => <option key={u} value={u}>{String(u).replace('|', ' - ')}</option>)}
          </select>
          <div className="text-sm text-slate-500 text-center">共 {filteredQs.length} 題</div>
          <button onClick={start} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">開始作答</button>
      </div>
  );

  if (mode === 'quiz') return (
      <div className="space-y-4 pb-10">
          {quizQs.map((q, i) => (
              <div key={q.id} className="bg-white p-4 rounded shadow">
                  <div className="font-bold mb-2 text-lg"><span className="text-indigo-500">{i+1}.</span> {q.content}</div>
                  {q.imageUrl && <RobustImage src={q.imageUrl} className="max-h-48 mb-2 rounded" />}
                  <div className="space-y-2">
                      {q.options.map((opt, idx) => (
                          <label key={idx} className={`flex items-center gap-2 p-3 border rounded cursor-pointer ${ans[q.id]===idx?'bg-indigo-50 border-indigo-500':''}`}>
                              <input type="radio" name={`${safeId}-q-${q.id}`} checked={ans[q.id]===idx} onChange={()=>setAns({...ans, [q.id]: idx})} className="w-4 h-4 accent-indigo-600"/>
                              <span className="text-sm">{opt}</span>
                          </label>
                      ))}
                  </div>
              </div>
          ))}
          <button onClick={submit} className="w-full bg-emerald-600 text-white py-3 rounded font-bold shadow-lg">交卷</button>
      </div>
  );

  if (mode === 'result') {
      const showAns = score >= (globalSettings.revealThreshold || 0);

      return (
          <div className="space-y-4">
              <div className="bg-white p-6 rounded text-center shadow">
                  <h2 className="text-3xl font-black text-indigo-600 mb-1">{score}分</h2>
                  <p className="text-sm text-slate-500">{name}</p>
                  <button onClick={()=>setMode('setup')} className="mt-4 px-4 py-2 bg-slate-100 rounded text-sm">重新測驗</button>
              </div>

              {/* 學生端已移除排行榜 */}

              <div className="space-y-3">
                  {quizQs.map((q, i) => {
                      const isRight = ans[q.id] === q.correctIndex;
                      return (
                          <div key={q.id} className={`p-4 bg-white rounded border-l-4 ${isRight?'border-green-500':'border-red-500'}`}>
                              <div className="font-bold mb-1">{i+1}. {q.content}</div>
                              {q.imageUrl && <RobustImage src={q.imageUrl} className="h-20 mb-2 rounded" />}
                              {!isRight && <div className="text-red-500 text-sm">你的答案: {q.options[ans[q.id]]}</div>}
                              {showAns ? (
                                  <div className="mt-2 text-sm bg-slate-50 p-2 rounded">
                                      <div className="text-green-600 font-bold">正解: {q.options[q.correctIndex]}</div>
                                      {q.rationale && <div className="text-xs text-slate-500 mt-1">{q.rationale}</div>}
                                  </div>
                              ) : <div className="text-xs text-slate-400 mt-1"><Lock className="w-3 h-3 inline"/> 詳解已隱藏</div>}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  }
  return null;
}