import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,                     
  onAuthStateChanged,
  signInWithCustomToken,
  setPersistence,
  browserLocalPersistence
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
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
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
  X,
  Users,
  AlertTriangle,
  Power,
  UserX,
  Library,
  ImagePlus,
  Timer
} from 'lucide-react';

// --- 錯誤邊界元件 ---
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
            <p className="mb-4 text-slate-600">系統發生非預期錯誤，請嘗試重新整理。</p>
            <div className="text-xs text-left bg-slate-100 p-2 rounded mb-4 overflow-auto max-h-32">
                {this.state.error && this.state.error.toString()}
            </div>
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
const APP_NAME = "quiz-master-v6-dedicated"; 

try {
  const existingApp = getApps().find(app => app.name === APP_NAME);
  if (existingApp) {
    app = existingApp;
  } else {
    app = initializeApp(firebaseConfig, APP_NAME);
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Persistence warning:", e));

} catch (e) {
  console.error("Firebase Init Critical Error:", e);
}

// 確保 App ID 在全域一致
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cloud-quiz-master-v1';

const SUBJECTS = ["國文", "英語", "數學", "自然", "地理", "歷史", "公民", "其他"];
const VOLUMES = ["第一冊", "第二冊", "第三冊", "第四冊", "第五冊", "第六冊", "總複習", "不分冊"];
const AUTO_LOGOUT_TIME = 60 * 60 * 1000; // 1小時 (毫秒)

const LoadingSpinner = () => (
  <div className="flex flex-col justify-center items-center h-[50dvh] text-indigo-600">
    <RefreshCcw className="animate-spin w-10 h-10 mb-2" />
    <span className="text-sm font-bold animate-pulse">系統載入中...</span>
  </div>
);

// 圖片元件：支援自訂樣式與錯誤處理
const RobustImage = ({ src, alt, className, style }) => {
  const [error, setError] = useState(false);
  if (!src) return null;
  if (error) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 border border-slate-200 rounded p-1 ${className}`} 
        style={style || {minHeight: '100px'}}
      >
        <ImageOff className="w-5 h-5 mb-1" />
        <span className="text-[10px] whitespace-nowrap">載入失敗</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} onError={() => setError(true)} />;
};

const shuffleQuestionOptions = (question) => {
  const indices = question.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledOptions = indices.map(i => question.options[i]);
  // 同步洗牌選項圖片 (如果有)
  const shuffledOptionImages = question.optionImages 
    ? indices.map(i => question.optionImages[i]) 
    : [null, null, null, null];

  const newCorrectIndex = indices.indexOf(question.correctIndex);
  
  return { 
      ...question, 
      options: shuffledOptions, 
      optionImages: shuffledOptionImages, // 回傳洗牌後的圖片陣列
      correctIndex: newCorrectIndex 
  };
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

  // --- 閒置自動登出邏輯 (v9.7 新增) ---
  useEffect(() => {
    if (!user) return; // 未登入不監控

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // 執行登出
        signOut(auth).then(() => {
            alert("⚠️ 系統提示\n\n您已閒置超過 1 小時，系統已自動為您登出以確保安全。");
            window.location.reload(); // 重新整理確保狀態清空
        }).catch(err => console.error("Auto logout failed", err));
      }, AUTO_LOGOUT_TIME);
    };

    // 監聽的事件列表
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // 綁定事件
    events.forEach(event => document.addEventListener(event, resetTimer));
    
    // 初始化計時器
    resetTimer();

    // 清除機制
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user]);
  // ------------------------------------

  useEffect(() => {
    if (!auth) {
      setInitError("Firebase 初始化失敗，請重新整理頁面。");
      setLoading(false);
      return;
    }

    if (auth.currentUser) {
        setUser(auth.currentUser);
        setCurrentView('dashboard');
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (u) {
            setCurrentView('dashboard');
        } else {
            setCurrentView('landing');
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    let unsubQ = () => {};
    let unsubS = () => {};

    try {
      unsubQ = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const getTime = (t) => t?.toMillis ? t.toMillis() : (t?.seconds ? t.seconds * 1000 : 0);
        docs.sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
        setQuestions(docs);
      }, (err) => {
        console.warn("Questions sync warning:", err.code);
      });

      unsubS = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_settings', 'global'), (docSnap) => {
          if (docSnap.exists()) setGlobalSettings(docSnap.data());
      }, (err) => {
          console.warn("Settings sync warning:", err.code);
      });
      
    } catch (err) {
      console.error("Firestore Setup Error:", err);
    }

    return () => { unsubQ(); unsubS(); };
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
            <h1 className="text-xl font-bold tracking-wide hidden sm:block">雲端測驗大師 v9.7</h1>
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
      {isTeacher && <TeacherDashboard questions={questions} globalSettings={globalSettings} userId={user.uid} windowId={windowId} user={user} appId={appId} />}
      {isStudent && <StudentDashboard questions={questions} globalSettings={globalSettings} windowId={windowId} user={user} appId={appId} />}
    </div>
  );
}

function LandingPage({ questionCount, currentUser, onEnterDashboard }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); 

  const handleStudentClick = async () => {
      if (currentUser && currentUser.isAnonymous) {
          onEnterDashboard();
      } else {
          try {
              setIsLoggingIn(true);
              if (currentUser) {
                  await signOut(auth).catch(e => console.warn("Sign out failed", e));
              }
              await signInAnonymously(auth);
          } catch (error) {
              console.error("Student login failed", error);
              if (error.code === 'auth/operation-not-allowed') {
                  alert("系統設定錯誤：請至 Firebase Console 開啟「匿名 (Anonymous)」登入功能。");
              } else {
                  alert("登入失敗: " + error.message);
              }
              setIsLoggingIn(false);
          }
      }
  };

  const handleTeacherClick = () => {
      if (currentUser && !currentUser.isAnonymous) {
          onEnterDashboard();
      } else {
          setShowLoginModal(true);
          setErrorMsg('');
          setIsRegistering(false); 
      }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
        if (isRegistering) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error("Auth Error:", error.code);
        switch (error.code) {
            case 'auth/operation-not-allowed':
                setErrorMsg('錯誤：請至 Firebase Console 開啟「電子郵件/密碼」登入功能');
                break;
            case 'auth/user-not-found':
            case 'auth/invalid-credential':
                setErrorMsg('帳號不存在或密碼錯誤');
                break;
            case 'auth/wrong-password':
                setErrorMsg('密碼錯誤');
                break;
            case 'auth/email-already-in-use':
                setErrorMsg('此 Email 已經被註冊過了');
                break;
            case 'auth/weak-password':
                setErrorMsg('密碼強度不足 (至少6位元)');
                break;
            case 'auth/invalid-email':
                setErrorMsg('Email 格式不正確');
                break;
            default:
                setErrorMsg('驗證失敗：' + error.message);
        }
        setIsLoggingIn(false);
    }
  };

  const handleReset = async () => {
      if(confirm("確定要重置登入狀態嗎？這將會強制登出。")) {
        try {
            await signOut(auth);
            window.location.reload();
        } catch(e) {
            alert("重置失敗");
        }
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
          className="group flex items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all hover:border-indigo-300 hover:shadow-md disabled:bg-slate-50 disabled:cursor-not-allowed"
        >
          <div className="bg-indigo-100 p-3 rounded-full mr-4">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-bold text-slate-800 text-lg">我是學生</h3>
            <p className="text-xs text-gray-400">
                {isLoggingIn ? '登入中...' : (currentUser && currentUser.isAnonymous ? '已登入，點擊繼續測驗' : '免註冊，直接進入測驗')}
            </p>
          </div>
          {isLoggingIn ? <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> : (currentUser && currentUser.isAnonymous ? <ArrowDown01 className="w-5 h-5 text-green-500" /> : <ChevronRight className="w-5 h-5 text-slate-300" />)}
        </button>

        <button 
          onClick={handleTeacherClick}
          disabled={isLoggingIn}
          className="group flex items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all hover:border-emerald-300 hover:shadow-md disabled:bg-slate-50 disabled:cursor-not-allowed"
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

        <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 mt-4">
            <Power className="w-3 h-3" /> 重置系統狀態
        </button>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xs animate-in zoom-in-95 border border-white/20">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                        <KeyRound className="w-5 h-5 text-emerald-500" />
                        {isRegistering ? '教師註冊' : '教師登入'}
                    </h3>
                    <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleAuthSubmit} className="space-y-4">
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
                            placeholder="輸入密碼 (至少6位)"
                            required
                            minLength={6}
                        />
                    </div>
                     
                    {errorMsg && <p className="text-xs text-red-500 text-center font-bold bg-red-50 p-2 rounded">{errorMsg}</p>}
                    
                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className={`w-full text-white font-bold py-3 rounded-xl text-sm flex justify-center items-center gap-2 mt-2 transition-colors shadow-sm ${isRegistering ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                        {isLoggingIn ? <RefreshCcw className="w-4 h-4 animate-spin" /> : (isRegistering ? '建立帳號並登入' : '確認登入')}
                    </button>

                    <div className="text-center mt-4">
                        <button 
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setErrorMsg('');
                            }}
                            className="text-xs text-slate-500 hover:text-indigo-600 underline"
                        >
                            {isRegistering ? '已有帳號？返回登入' : '沒有帳號？立即註冊'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

function StudentManager({ user, appId }) {
    const [students, setStudents] = useState([]);
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [permissionError, setPermissionError] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_students'), 
            (snap) => {
                setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setPermissionError(false);
            }, 
            (err) => {
                console.warn("Student snapshot permission issue:", err.code);
                if (err.code === 'permission-denied') {
                    setPermissionError(true);
                }
            }
        );
        return () => unsub();
    }, [user, appId]);

    const addStudent = async (e) => {
        e.preventDefault();
        if (!id || !name) return alert('請輸入完整資料');
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_students', id), { name });
            setId(''); setName('');
            alert('新增成功！');
        } catch (err) {
            console.error(err);
            alert('新增失敗：' + err.code);
        }
    };

    const handleClearAllStudents = async () => {
        if (!students.length) return;
        if (!window.confirm(`⚠️ 危險操作警告 ⚠️\n\n您即將刪除所有 ${students.length} 位學生的資料。\n\n此動作無法復原！確定要執行嗎？`)) return;
        if (!window.confirm("再次確認：您真的要清空所有學生名單嗎？")) return;

        setIsImporting(true);
        try {
            const promises = students.map(s => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_students', s.id)));
            await Promise.all(promises);
            alert("已成功清空所有學生資料");
        } catch (err) {
            console.error(err);
            alert("刪除過程發生錯誤：" + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const handleBulkImport = async () => {
        if (!bulkText.trim()) return alert('請輸入資料');
        setIsImporting(true);
        
        const rawLines = bulkText.replace(/\r\n/g, '\n').split('\n');
        let successCount = 0;
        let failedLines = [];

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i].trim();
            if (!line) continue; 

            let sid = null;
            let sname = null;

            if (line.includes('\t')) {
                const parts = line.split('\t');
                sid = parts[0].trim();
                sname = parts[1]?.trim();
            } else if (line.includes(',')) {
                const parts = line.split(',');
                sid = parts[0].trim();
                sname = parts[1]?.trim();
            } else if (line.includes(' ')) {
                const firstSpaceIndex = line.indexOf(' ');
                sid = line.substring(0, firstSpaceIndex).trim();
                sname = line.substring(firstSpaceIndex + 1).trim();
            }

            if (sid && sname) {
                const safeSid = sid.replace(/[.#$\/\[\]]/g, '_');
                try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_students', safeSid), { name: sname });
                    successCount++;
                } catch (err) {
                    failedLines.push(`第 ${i+1} 行: 寫入失敗`);
                }
            } else {
                failedLines.push(`第 ${i+1} 行: 格式無法識別`);
            }
        }

        setIsImporting(false);
        let msg = `匯入完成！\n成功：${successCount} 筆`;
        if (failedLines.length > 0) msg += `\n失敗：${failedLines.length} 筆`;
        alert(msg);
        if (successCount > 0) {
            setBulkText('');
            setShowBulk(false);
        }
    };

    const removeStudent = async (sid) => {
        if (window.confirm(`確定刪除 ${sid}?`)) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_students', sid));
            } catch (err) {
                alert("刪除失敗");
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-xl mb-4 text-slate-700 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-500"/> 學生名單管理
                </div>
                {students.length > 0 && (
                    <button 
                        onClick={handleClearAllStudents}
                        disabled={isImporting}
                        className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 px-3 py-1.5 rounded font-bold flex items-center gap-1 transition shadow-sm"
                    >
                        <UserX className="w-4 h-4" /> 清空名單
                    </button>
                )}
            </h3>
            
            {permissionError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 p-4 rounded text-rose-800 text-sm flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="w-6 h-6 shrink-0 text-rose-600" />
                    <div><strong>⚠️ 權限受限</strong> <p>無法讀取名單，但可新增。</p></div>
                </div>
            )}

            <div className="flex gap-2 mb-4 bg-slate-100 p-1.5 rounded-lg">
                <button onClick={() => setShowBulk(false)} className={`flex-1 py-2 text-base rounded-md transition font-bold ${!showBulk ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>單筆新增</button>
                <button onClick={() => setShowBulk(true)} className={`flex-1 py-2 text-base rounded-md transition font-bold ${showBulk ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>批次匯入</button>
            </div>

            {!showBulk ? (
                <form onSubmit={addStudent} className="flex gap-2 mb-4">
                    <input value={id} onChange={e=>setId(e.target.value)} className="border p-2.5 rounded text-base w-1/3 outline-none focus:border-indigo-500" placeholder="身分證字號" />
                    <input value={name} onChange={e=>setName(e.target.value)} className="border p-2.5 rounded text-base flex-1 outline-none focus:border-indigo-500" placeholder="姓名" />
                    <button type="submit" className="bg-indigo-600 text-white px-5 rounded text-base font-bold hover:bg-indigo-700 transition">新增</button>
                </form>
            ) : (
                <div className="mb-4">
                    <textarea 
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        className="w-full h-48 border p-3 rounded text-base font-mono mb-2 outline-none focus:border-indigo-500"
                        placeholder="請貼上名單 (學號 姓名)..."
                    />
                    <button 
                        onClick={handleBulkImport} 
                        disabled={isImporting}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded text-base font-bold hover:bg-emerald-700 transition flex justify-center items-center gap-2"
                    >
                        {isImporting ? <RefreshCcw className="w-5 h-5 animate-spin"/> : <UploadCloud className="w-5 h-5"/>}
                        {isImporting ? '處理中...' : '開始匯入'}
                    </button>
                </div>
            )}

            <div className="divide-y max-h-80 overflow-y-auto border rounded bg-white">
                {students.map(s => (
                    <div key={s.id} className="p-4 flex justify-between items-center hover:bg-slate-50 group">
                        <span className="text-base"><span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded mr-2 font-bold">{s.id}</span>{s.name}</span>
                        <button onClick={()=>removeStudent(s.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-5 h-5"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BulkImport({ userId, appId }) {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState('匯入題庫');
  const [importSubject, setImportSubject] = useState('數學'); 
  const [importVolume, setImportVolume] = useState('第一冊'); 
  const [preview, setPreview] = useState([]);
  
  const handleParse = () => {
    const parsed = text.split('\n').filter(l => l.trim()).map(line => {
      const p = line.split('|');
      if (p.length >= 6) return { 
          content: p[0].trim(), 
          options: [p[1], p[2], p[3], p[4]].map(s=>s.trim()), 
          correctIndex: parseInt(p[5])-1, 
          unit, 
          subject: importSubject, 
          volume: importVolume,   
          imageUrl: p[6]?.trim()||'', 
          rationale: p[7]?.trim()||'' 
      };
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
    <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex gap-3 mb-4">
            <select value={importSubject} onChange={e => setImportSubject(e.target.value)} className="border rounded-lg p-2.5 text-base w-28 outline-none focus:ring-2 focus:ring-indigo-500">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={importVolume} onChange={e => setImportVolume(e.target.value)} className="border rounded-lg p-2.5 text-base w-28 outline-none focus:ring-2 focus:ring-indigo-500">{VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}</select>
            <input value={unit} onChange={e=>setUnit(e.target.value)} className="border p-2.5 rounded-lg text-base flex-1 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="單元名稱" />
        </div>

        <textarea value={text} onChange={e=>setText(e.target.value)} className="border p-3 w-full h-48 text-sm font-mono rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="題目|A|B|C|D|1|img|詳解" />
        
        <div className="flex gap-3 mt-4">
            <button onClick={handleParse} className="flex-1 bg-slate-500 hover:bg-slate-600 text-white text-base font-bold py-3 rounded-lg transition shadow-sm">預覽</button>
            {preview.length > 0 && <button onClick={handleImport} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-3 rounded-lg transition shadow-sm">確認匯入 {preview.length} 題</button>}
        </div>
    </div>
  );
}

function TeacherDashboard({ questions, globalSettings, userId, windowId, user, appId }) {
  const [activeTab, setActiveTab] = useState('list'); 
  const [selectedSubject, setSelectedSubject] = useState('全部'); 
  const [editingId, setEditingId] = useState(null); 
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingLeaderboard, setViewingLeaderboard] = useState(null); 

  const safeWindowId = windowId || `teacher-${Math.random()}`;

  const [newQuestion, setNewQuestion] = useState({
    subject: '數學',
    volume: '第一冊',
    unit: '',
    content: '',
    options: ['', '', '', ''],
    optionImages: [null, null, null, null], // 新增：選項圖片陣列
    correctIndex: 0,
    imageUrl: '',
    rationale: '' 
  });
   
  const [results, setResults] = useState([]);
  const [thresholdInput, setThresholdInput] = useState(globalSettings?.revealThreshold ?? 60);
  const [expandedUnits, setExpandedUnits] = useState({}); 
  const [expandedResultUnits, setExpandedResultUnits] = useState({});

  useEffect(() => {
    if (activeTab === 'results' && user) {
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            docs.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
            setResults(docs);
        }, (err) => console.warn("Results snapshot warning", err.code));
        return () => unsubscribe();
    }
  }, [activeTab, user]);

  const structuredQuestions = useMemo(() => {
    const structure = {};
    const filtered = selectedSubject === '全部' ? questions : questions.filter(q => q.subject === selectedSubject);
    
    filtered.forEach(q => {
        const sub = q.subject || '其他';
        const vol = q.volume || '未分類';
        const unit = q.unit || '一般試題';
        
        if (!structure[sub]) structure[sub] = {};
        if (!structure[sub][vol]) structure[sub][vol] = {};
        if (!structure[sub][vol][unit]) structure[sub][vol][unit] = [];
        
        structure[sub][vol][unit].push(q);
    });
    return structure;
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

  const toggleUnit = (uniqueKey) => setExpandedUnits(p => ({ ...p, [uniqueKey]: !p[uniqueKey] }));
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

  const handleDelete = async (q) => {
    if (!window.confirm('確定刪除？')) return;

    // 刪除主圖
    if (q.imageUrl) {
        try {
            await deleteObject(ref(storage, q.imageUrl));
        } catch (e) { console.warn("Image delete failed", e); }
    }

    // 刪除選項圖片
    if (q.optionImages) {
        for (const imgUrl of q.optionImages) {
            if (imgUrl) {
                try {
                    await deleteObject(ref(storage, imgUrl));
                } catch (e) { console.warn("Opt img delete failed", e); }
            }
        }
    }

    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', q.id));
  };

  const handleDeleteFolder = async (items) => {
    if (window.confirm(`確定要刪除「${items.length}」題嗎？`)) {
        try {
            const deletePromises = items.map(async (item) => {
                // 刪除圖片
                if (item.imageUrl) await deleteObject(ref(storage, item.imageUrl)).catch(e=>console.warn(e));
                if (item.optionImages) {
                    for(const url of item.optionImages) {
                        if(url) await deleteObject(ref(storage, url)).catch(e=>console.warn(e));
                    }
                }
                // 刪除文件
                return deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', item.id));
            });
            
            await Promise.all(deletePromises);
            alert(`刪除成功`);
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
          optionImages: q.optionImages || [null, null, null, null],
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
        const fileName = `${Date.now()}_main_${file.name}`;
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

  // 處理選項圖片上傳
  const handleOptionImageUpload = async (index, file) => {
      if (!file) return;
      setIsUploading(true);
      try {
          const fileName = `${Date.now()}_opt${index}_${file.name}`;
          const storageRef = ref(storage, `artifacts/${appId}/public/images/${fileName}`);
          await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(storageRef);
          
          const updatedOptionImages = [...newQuestion.optionImages];
          updatedOptionImages[index] = downloadUrl;
          setNewQuestion({ ...newQuestion, optionImages: updatedOptionImages });
      } catch (error) {
          alert("選項圖片上傳失敗");
      } finally {
          setIsUploading(false);
      }
  };

  // 移除選項圖片
  const handleRemoveOptionImage = (index) => {
      const updatedOptionImages = [...newQuestion.optionImages];
      updatedOptionImages[index] = null;
      setNewQuestion({ ...newQuestion, optionImages: updatedOptionImages });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newQuestion.content || newQuestion.options.some(opt => !opt) || !newQuestion.unit) return alert("資料不完整");
    
    try {
      // 確保 optionImages 存在
      const data = { 
          ...newQuestion, 
          optionImages: newQuestion.optionImages || [null, null, null, null],
          updatedAt: serverTimestamp() 
      };

      if (editingId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_questions', editingId), data);
          alert("更新成功");
      } else {
          data.createdAt = serverTimestamp();
          data.createdBy = userId;
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_questions'), data);
          alert("新增成功");
      }
      setNewQuestion({ 
          subject: newQuestion.subject, // 保留上次選擇的科目
          volume: newQuestion.volume,   // 保留上次選擇的冊次
          unit: newQuestion.unit,       // 保留上次輸入的單元
          content: '', 
          options: ['','','',''], 
          optionImages: [null, null, null, null],
          correctIndex: 0,
          imageUrl: '', 
          rationale: '' 
      });
      setEditingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab('list');
    } catch (err) {
      alert("操作失敗: " + err.message);
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
            @page { size: A4; margin: 1cm; }
            body { font-family: "Microsoft JhengHei", sans-serif; padding: 0; color: #333; font-size: 10pt; line-height: 1.3; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; column-span: all; }
            .header h1 { margin: 5px 0; font-size: 16pt; }
            .header p { margin: 2px 0; }
            .content-wrapper { column-count: 2; column-gap: 15px; }
            .question { margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #ccc; padding: 8px; border-radius: 4px; background: #fff; }
            .q-content { font-weight: bold; margin-bottom: 5px; font-size: 11pt; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-left: 10px; font-size: 10pt; }
            .option { padding: 0; }
            .answer-section { margin-top: 8px; font-size: 9pt; color: #444; background: #f0f0f0; padding: 6px; border-radius: 4px; border-left: 3px solid #999; }
            .correct { color: #10b981; font-weight: bold; }
            .wrong { color: #ef4444; text-decoration: line-through; }
            .rationale { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc; font-size: 9pt; }
            .rationale-label { font-weight: bold; color: #d97706; }
            img { max-width: 100%; max-height: 150px; display: block; margin: 5px auto; border: 1px solid #ddd; }
            .opt-img { max-height: 80px; display: block; margin-top: 2px; }
            @media print { .no-print { display: none; } body { background: #fff; } .question { border: 1px solid #ddd; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>錯題複習卷</h1>
            <p><strong>姓名：</strong>${result.studentName} &nbsp;|&nbsp; <strong>單元：</strong>${result.unit} &nbsp;|&nbsp; <strong>得分：</strong>${result.score}</p>
            <p style="font-size: 0.8em; color: #666;">列印時間：${new Date().toLocaleString()}</p>
          </div>
          <div class="content-wrapper">
            ${result.mistakes.map((m, idx) => `
              <div class="question">
                <div class="q-content">${idx + 1}. ${m.content}</div>
                ${m.imageUrl ? `<img src="${m.imageUrl}" alt="題目附圖" />` : ''}
                <div class="options">
                    ${m.options.map((opt, i) => `
                        <div class="option">
                            (${['A','B','C','D'][i]}) ${opt}
                            ${m.optionImages && m.optionImages[i] ? `<img src="${m.optionImages[i]}" class="opt-img" />` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="answer-section">
                  <div><span>你的答案：${m.studentAnswerIndex !== undefined ? ['A','B','C','D'][m.studentAnswerIndex] : '未作答'}</span>&nbsp;&nbsp;|&nbsp;&nbsp;<span class="correct">正確答案：${['A','B','C','D'][m.correctIndex]}</span></div>
                  ${m.rationale ? `<div class="rationale"><span class="rationale-label">【詳解】</span>${m.rationale}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #2563eb; color: white; border: none; border-radius: 5px;">列印此頁</button>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6"> 
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6" /> 後台管理
        </h2>
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded border">
            <span className="text-sm font-bold">詳解門檻:</span>
            <input 
                type="number" 
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-16 text-center text-sm border rounded p-1"
            />
            <button onClick={updateThreshold} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded font-bold">更新</button>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-2 rounded-lg overflow-x-auto">
          {[
            { id: 'list', label: '列表', icon: <FileText className="w-4 h-4 mr-1"/> },
            { id: 'add', label: editingId ? '編輯' : '新增', icon: <Plus className="w-4 h-4 mr-1"/> },
            { id: 'import', label: '匯入', icon: <UploadCloud className="w-4 h-4 mr-1"/> },
            { id: 'results', label: '成績', icon: <BarChart3 className="w-4 h-4 mr-1" /> },
            { id: 'students', label: '學生管理', icon: <Users className="w-4 h-4 mr-1"/> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => {
                  if (tab.id !== 'add') { setEditingId(null); }
                  setActiveTab(tab.id);
              }}
              className={`flex items-center whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition ${activeTab === tab.id ? 'bg-white shadow text-indigo-700 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden p-3 space-y-4">
          <div className="border-b pb-2 mb-2">
              <div className="flex gap-2 overflow-x-auto">
                  <button onClick={() => setSelectedSubject('全部')} className={`px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${selectedSubject === '全部' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>全部</button>
                  {SUBJECTS.map(s => <button key={s} onClick={() => setSelectedSubject(s)} className={`px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${selectedSubject === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>)}
              </div>
          </div>

          {Object.entries(structuredQuestions).sort().map(([subject, volumes]) => (
              <div key={subject} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-4">
                  <div className="bg-indigo-100 px-4 py-3 border-b border-indigo-200 flex items-center gap-2">
                      <Library className="w-5 h-5 text-indigo-700" />
                      <h2 className="text-lg font-bold text-indigo-900">{subject}</h2>
                  </div>
                  
                  <div className="p-2 space-y-3">
                      {Object.entries(volumes).sort().map(([volume, units]) => (
                          <div key={volume} className="pl-2 border-l-2 border-slate-300 ml-2">
                              <div className="flex items-center gap-2 mb-2 mt-1">
                                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                  <h3 className="font-bold text-slate-600 text-base">{volume}</h3>
                              </div>

                              <div className="space-y-2 pl-4">
                                  {Object.entries(units).sort().map(([unit, unitQuestions]) => {
                                      const uniqueKey = `${subject}-${volume}-${unit}`;
                                      const isExpanded = expandedUnits[uniqueKey];
                                      
                                      return (
                                          <div key={uniqueKey} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                                              <div 
                                                  className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition" 
                                                  onClick={() => toggleUnit(uniqueKey)}
                                              >
                                                  <div className="flex items-center gap-3 text-base font-bold text-slate-700">
                                                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400"/> : <ChevronRight className="w-5 h-5 text-slate-400"/>}
                                                      <Folder className="w-5 h-5 text-amber-500" />
                                                      <span>{unit}</span>
                                                      <span className="text-xs font-normal bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 border">{unitQuestions.length}題</span>
                                                  </div>
                                                  <button 
                                                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(unitQuestions); }} 
                                                      className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition"
                                                      title="刪除此單元所有題目"
                                                  >
                                                      <FolderX className="w-4 h-4"/>
                                                  </button>
                                              </div>
                                              
                                              {isExpanded && (
                                                  <div className="bg-white divide-y divide-slate-100 border-t border-slate-100">
                                                      {unitQuestions.map((q, idx) => (
                                                          <div key={q.id} className="p-3 flex justify-between items-start group hover:bg-indigo-50/50">
                                                              {q.imageUrl && (
                                                                  <div className="mr-4 shrink-0">
                                                                      <RobustImage 
                                                                          src={q.imageUrl} 
                                                                          className="w-16 h-16 object-cover rounded border border-slate-200" 
                                                                          style={{minHeight: 'auto'}} 
                                                                      />
                                                                  </div>
                                                              )}
                                                              <div className="flex-1 text-sm pr-4">
                                                                  <span className="text-indigo-500 font-bold mr-2">#{idx+1}</span>
                                                                  {(q.content || '').substring(0, 50)}{(q.content || '').length > 50 ? '...' : ''}
                                                              </div>
                                                              <div className="flex gap-1">
                                                                  <button onClick={() => handleEdit(q)} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded"><Pencil className="w-4 h-4"/></button>
                                                                  <button onClick={() => handleDelete(q)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                                              </div>
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
          
          {Object.keys(structuredQuestions).length === 0 && (
              <div className="text-center p-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Folder className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>目前沒有題目資料</p>
              </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-slate-700">
             {editingId ? <Pencil className="w-6 h-6 text-amber-500"/> : <Plus className="w-6 h-6 text-indigo-500"/>} 
             {editingId ? '編輯題目' : '新增題目'}
          </h3>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">科目</label>
                    <select value={newQuestion.subject} onChange={e => setNewQuestion({...newQuestion, subject: e.target.value})} className="w-full border p-3 rounded-lg text-base outline-none focus:ring-2 focus:ring-indigo-500">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">冊次</label>
                    <select value={newQuestion.volume} onChange={e => setNewQuestion({...newQuestion, volume: e.target.value})} className="w-full border p-3 rounded-lg text-base outline-none focus:ring-2 focus:ring-indigo-500">{VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}</select>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">單元名稱</label>
                <input type="text" value={newQuestion.unit} onChange={e => setNewQuestion({...newQuestion, unit: e.target.value})} className="w-full border p-3 rounded-lg text-base outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: 3-1 數列" />
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">題目內容</label>
                <textarea value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="w-full border p-3 rounded-lg text-base h-32 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="請輸入題目敘述..." />
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-1"><ImageIcon className="w-4 h-4"/> 附圖 (選填)</label>
                <div className="flex gap-2 items-center">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="text-sm w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" disabled={isUploading}/>
                    {newQuestion.imageUrl && <span className="text-sm text-green-600 font-bold flex items-center gap-1 bg-green-50 px-2 py-1 rounded"><CheckCircle className="w-4 h-4"/>已上傳</span>}
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">詳解 (選填)</label>
                <textarea value={newQuestion.rationale} onChange={e => setNewQuestion({...newQuestion, rationale: e.target.value})} className="w-full border p-3 rounded-lg text-base h-20 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="輸入詳解..." />
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-500">選項設定 (支援圖片)</label>
                {newQuestion.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${newQuestion.correctIndex === idx ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'border-slate-300'}`}>
                        <div className="pt-2">
                            <input 
                                type="radio" 
                                name={`ans-${safeWindowId}`} 
                                checked={newQuestion.correctIndex === idx} 
                                onChange={() => setNewQuestion({...newQuestion, correctIndex: idx})} 
                                className="w-5 h-5 accent-green-600 cursor-pointer"
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <input 
                                type="text" 
                                value={opt} 
                                onChange={e => { const n = [...newQuestion.options]; n[idx] = e.target.value; setNewQuestion({...newQuestion, options: n}); }} 
                                className="w-full bg-transparent outline-none text-base border-b border-slate-200 focus:border-indigo-500 pb-1" 
                                placeholder={`選項 ${idx+1} 文字描述`} 
                            />
                            {/* 選項圖片預覽區 */}
                            {newQuestion.optionImages && newQuestion.optionImages[idx] && (
                                <div className="relative inline-block mt-2">
                                    <img src={newQuestion.optionImages[idx]} alt="Option" className="h-20 w-auto rounded border border-slate-300" />
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveOptionImage(idx)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* 選項圖片上傳按鈕 */}
                        <div className="pt-1">
                            <label className="cursor-pointer text-slate-400 hover:text-indigo-600 transition p-2 hover:bg-indigo-50 rounded-full block" title="上傳選項圖片">
                                <ImagePlus className="w-5 h-5" />
                                <input 
                                    type="file" 
                                    hidden 
                                    accept="image/*"
                                    onChange={(e) => handleOptionImageUpload(idx, e.target.files[0])}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                    </div>
                ))}
            </div>

            <button type="submit" disabled={isUploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg text-lg font-bold transition shadow-md mt-4">
                {editingId ? '更新題目' : '新增題目'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'students' && <StudentManager user={user} appId={appId} />}

      {activeTab === 'import' && <BulkImport userId={userId} appId={appId} />}

      {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow overflow-hidden p-3 space-y-3">
              {Object.entries(resultsByUnit).map(([unit, unitResults]) => (
                  <div key={unit} className="border rounded-lg bg-slate-50 overflow-hidden">
                      <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition" onClick={() => toggleResultUnit(unit)}>
                          <span className="text-base font-bold flex items-center gap-2 text-slate-700">
                              {expandedResultUnits[unit] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                              <Folder className="w-5 h-5 text-indigo-500" />
                              {unit} <span className="text-sm font-normal text-slate-500 bg-white border px-2 py-0.5 rounded-full">{unitResults.length}</span>
                          </span>
                          <div className="flex gap-2">
                              {/* 🏆 排行榜按鈕 */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setViewingLeaderboard(unit); }} 
                                className="text-sm bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-sm transition"
                              >
                                  <Trophy className="w-4 h-4" /> 排行榜
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteResultFolder(unit, unitResults); }} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition" title="清空此單元成績"><FolderX className="w-5 h-5"/></button>
                          </div>
                      </div>
                      {expandedResultUnits[unit] && (
                          <div className="bg-white divide-y divide-slate-100">
                              {unitResults.map(r => (
                                  <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                                      <div className="text-base flex-1">
                                          <span className="font-bold text-slate-800 mr-2">{r.studentName}</span>
                                          <span className={`font-bold ${r.score>=60?'text-emerald-600':'text-red-500'}`}>{r.score}分</span>
                                          <span className="text-xs text-slate-400 ml-2 block sm:inline">
                                              {r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString() : ''}
                                          </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button onClick={() => handlePrintMistakes(r)} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition" title="列印錯題"><Printer className="w-5 h-5"/></button>
                                          <button onClick={() => handleDeleteResult(r.id)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition" title="刪除紀錄"><Trash2 className="w-5 h-5"/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}

      {viewingLeaderboard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewingLeaderboard(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2 text-lg"><Trophy className="w-6 h-6 text-yellow-300" /> {viewingLeaderboard} 排名</h3>
                      <button onClick={() => setViewingLeaderboard(null)} className="hover:bg-white/20 p-1 rounded"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                      <div className="divide-y">
                          {getLeaderboardData(viewingLeaderboard).map((student, idx) => (
                              <div key={idx} className={`p-4 flex items-center justify-between ${idx < 3 ? 'bg-yellow-50/50' : 'hover:bg-slate-50'}`}>
                                  <div className="flex items-center gap-4">
                                      <div className="w-8 text-center font-bold text-slate-400 text-lg">
                                          {idx === 0 ? <Medal className="w-8 h-8 text-yellow-500 mx-auto" /> : 
                                           idx === 1 ? <Medal className="w-8 h-8 text-slate-400 mx-auto" /> :
                                           idx === 2 ? <Medal className="w-8 h-8 text-amber-600 mx-auto" /> :
                                           `#${idx + 1}`}
                                      </div>
                                      <span className="font-bold text-slate-700 text-base">{student.studentName}</span>
                                  </div>
                                  <span className={`font-bold text-lg ${student.score >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>{student.score} 分</span>
                              </div>
                          ))}
                          {getLeaderboardData(viewingLeaderboard).length === 0 && <div className="p-8 text-center text-slate-400">尚無成績紀錄</div>}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

function StudentDashboard({ questions, globalSettings, windowId, user, appId }) {
  const [mode, setMode] = useState('setup');
  const [selSub, setSelSub] = useState('數學');
  const [selUnit, setSelUnit] = useState('all');
  const [name, setName] = useState('');
  const [quizQs, setQuizQs] = useState([]);
  const [ans, setAns] = useState({});
  const [score, setScore] = useState(0);
  const [isImproved, setIsImproved] = useState(false);
  const [questionCount, setQuestionCount] = useState(0); // 新增題數選擇
  const [studentIdInput, setStudentIdInput] = useState(''); // 新增身分證輸入
  const [isVerifying, setIsVerifying] = useState(false); // 驗證中狀態
  
  const safeId = windowId || `student-${Math.random()}`;

  const filteredQs = useMemo(() => {
      return questions.filter(q => q.subject === selSub && (selUnit === 'all' || `${q.volume}|${q.unit}` === selUnit));
  }, [questions, selSub, selUnit]);

  // 當題目篩選變動時，預設選取最大題數
  useEffect(() => {
      setQuestionCount(filteredQs.length);
  }, [filteredQs.length]);

  const units = useMemo(() => [...new Set(questions.filter(q => q.subject === selSub).map(q => `${q.volume}|${q.unit}`))].sort(), [questions, selSub]);

  // 學生登入驗證
  const handleStudentLogin = async (e) => {
      e.preventDefault();
      if (!studentIdInput) return alert("請輸入身分證字號");
      setIsVerifying(true);
      
      // 修正 ID：移除可能導致路徑錯誤的字元
      const safeSid = studentIdInput.trim().replace(/[.#$\/\[\]]/g, '_');

      try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'quiz_students', safeSid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
              setName(docSnap.data().name); // 設定姓名
              alert(`歡迎, ${docSnap.data().name}`);
          } else {
              alert("找不到此學號，請確認輸入是否正確。");
              setName(''); // 清除姓名以防萬一
          }
      } catch (err) {
          console.error(err);
          alert("登入驗證發生錯誤，請稍後再試");
      } finally {
          setIsVerifying(false);
      }
  };

  const start = () => {
      if (!name) return alert("請先登入");
      if (filteredQs.length === 0) return alert("無題目");
      
      // 根據選取的題數進行切片 (Random Slice)
      const selectedQuestions = filteredQs
          .sort(() => 0.5 - Math.random()) // 先全域洗牌
          .slice(0, questionCount);        // 再切出指定數量

      setQuizQs(selectedQuestions.map(shuffleQuestionOptions)); // 最後洗牌選項
      setAns({});
      setMode('quiz');
  };

  const handleRetryMistakes = () => {
      const wrongQuestions = quizQs.filter(q => ans[q.id] !== q.correctIndex);
      if (wrongQuestions.length === 0) return;

      const reshuffledMistakes = wrongQuestions.map(q => shuffleQuestionOptions(q));
      
      setQuizQs(reshuffledMistakes);
      setAns({});
      setScore(0);
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
      
      setMode('result');
      // 簡單判斷進步 (這裡僅為 UI 示意，若需完整需 fetch 歷史紀錄)
      setIsImproved(false); 

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results'), {
          studentName: name, score: finalScore, unit: currentUnitName,
          submittedAt: serverTimestamp(), mistakes, totalQuestions: quizQs.length, correctCount: correct
      });
  };

  if (mode === 'setup') return (
      <div className="bg-white p-6 rounded-xl shadow-md space-y-4 border-t-4 border-indigo-500">
          <h2 className="font-bold text-lg">開始測驗</h2>
          
          {/* 學生身分驗證區塊 */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="text-sm font-bold text-slate-700 block mb-2">學生登入</label>
              {name ? (
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                              <CheckCircle className="w-5 h-5" />
                          </div>
                          <div>
                              <div className="text-sm font-bold text-slate-800">{name}</div>
                              <div className="text-xs text-slate-500">已登入</div>
                          </div>
                      </div>
                      <button onClick={() => { setName(''); setStudentIdInput(''); }} className="text-xs text-red-500 underline">登出</button>
                  </div>
              ) : (
                  <form onSubmit={handleStudentLogin} className="flex gap-2">
                      <input 
                          type="text" 
                          value={studentIdInput}
                          onChange={(e) => setStudentIdInput(e.target.value)}
                          className="flex-1 border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          placeholder="請輸入身分證字號"
                      />
                      <button 
                          type="submit" 
                          disabled={isVerifying}
                          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold disabled:bg-slate-400"
                      >
                          {isVerifying ? '...' : '登入'}
                      </button>
                  </form>
              )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
              {SUBJECTS.map(s => <button key={s} onClick={()=>setSelSub(s)} className={`px-3 py-1 rounded-full text-sm border whitespace-nowrap ${selSub===s?'bg-indigo-600 text-white':'bg-white'}`}>{s}</button>)}
          </div>
          <select value={selUnit} onChange={e=>setSelUnit(e.target.value)} className="w-full border rounded p-2">
              <option value="all">全部範圍</option>
              {units.map(u => <option key={u} value={u}>{String(u).replace('|', ' - ')}</option>)}
          </select>
          
          {/* 題數選擇滑桿 */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              題數: <span className="font-bold text-indigo-600">{questionCount}</span> 題
            </label>
            <input 
              type="range" 
              min="1" 
              max={Math.max(1, filteredQs.length)} 
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>1題</span>
              <span>{Math.max(1, filteredQs.length)}題 (全)</span>
            </div>
          </div>

          <button onClick={start} disabled={!name} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold disabled:bg-slate-300">開始作答</button>
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
                              <div className="flex flex-col">
                                <span className="text-sm">{opt}</span>
                                {q.optionImages && q.optionImages[idx] && (
                                    <img src={q.optionImages[idx]} alt="Option" className="mt-2 max-h-32 rounded border border-slate-200" />
                                )}
                              </div>
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
                  
                  <div className="flex justify-center gap-2 mt-4">
                      <button onClick={()=>setMode('setup')} className="px-4 py-2 bg-slate-100 rounded text-sm flex items-center gap-1 hover:bg-slate-200">
                          <RotateCcw className="w-4 h-4" /> 重新測驗
                      </button>
                      
                      {/* 錯題重測按鈕 */}
                      {score < 100 && (
                          <button 
                            onClick={handleRetryMistakes} 
                            className="px-4 py-2 bg-rose-100 text-rose-700 rounded text-sm font-bold flex items-center gap-1 hover:bg-rose-200"
                          >
                              <Shuffle className="w-4 h-4" /> 錯題重測
                          </button>
                      )}
                  </div>
              </div>

              <div className="space-y-3">
                  {quizQs.map((q, i) => {
                      const isRight = ans[q.id] === q.correctIndex;
                      return (
                          <div key={q.id} className={`p-4 bg-white rounded border-l-4 ${isRight?'border-green-500':'border-red-500'}`}>
                              <div className="font-bold mb-1">{i+1}. {q.content}</div>
                              {q.imageUrl && <RobustImage src={q.imageUrl} className="h-20 mb-2 rounded" />}
                              {!isRight && (
                                  <div className="text-red-500 text-sm mb-1">
                                      你的答案: {q.options[ans[q.id]]}
                                      {q.optionImages && q.optionImages[ans[q.id]] && (
                                          <img src={q.optionImages[ans[q.id]]} alt="Your Answer" className="mt-1 max-h-20 border border-red-200 rounded block" />
                                      )}
                                  </div>
                              )}
                              {showAns ? (
                                  <div className="mt-2 text-sm bg-slate-50 p-2 rounded">
                                      <div className="text-green-600 font-bold">
                                          正解: {q.options[q.correctIndex]}
                                          {q.optionImages && q.optionImages[q.correctIndex] && (
                                              <img src={q.optionImages[q.correctIndex]} alt="Correct Answer" className="mt-1 max-h-20 border border-green-200 rounded block" />
                                          )}
                                      </div>
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