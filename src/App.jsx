import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  signOut,                     
  onAuthStateChanged,
  signInWithCustomToken,
  setPersistence,           // 新增
  browserSessionPersistence // 新增：設定為 Session 級別
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
  X,
  Users,
  AlertTriangle
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
// 請將以下的字串換成您 Firebase 後台顯示的真實資料
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
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

// v5.0: 使用環境變數或預設 ID，確保部署後路徑正確
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cloud-quiz-master-v1';

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
  
  // v5.9: 強制預設為 'landing'，即使已登入也不自動切換
  const [currentView, setCurrentView] = useState('landing');

  const leftWindowIdRef = useRef(`win-${Math.random().toString(36).substr(2, 5)}`);
  const rightWindowIdRef = useRef(`win-${Math.random().toString(36).substr(2, 5)}`);

  useEffect(() => {
    if (!auth) {
      setInitError("Firebase 初始化失敗，請檢查網路。");
      setLoading(false);
      return;
    }

    const initAuth = async () => {
        try {
            // v5.9: 設定為 Session 模式 - 關閉瀏覽器即登出
            // 這確保了老師關閉網頁後，其他人無法直接進入後台
            await setPersistence(auth, browserSessionPersistence);

            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token).catch(e => console.warn(e));
            }
            
            const unsubscribe = onAuthStateChanged(auth, (u) => {
                setUser(u);
                // v5.9 修改：這裡我們不再自動 setCurrentView('dashboard')
                // 這樣每次 F5 重新整理或開啟網頁，都會停留在 Landing Page
                setLoading(false);
            });
            return unsubscribe;
        } catch (err) {
            console.error("Auth Init Error:", err);
            setInitError(err.message);
            setLoading(false);
        }
    };

    const unsub = initAuth();
    return () => { if (unsub && typeof unsub === 'function') unsub(); };
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

  const showLanding = currentView === 'landing'; // v5.9: 簡化判斷，只看 currentView

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800 font-sans flex flex-col notranslate" translate="no">
      <header className="bg-indigo-600 text-white shadow-lg shrink-0 z-20 relative">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity active:scale-95"
            onClick={goHome}
          >
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wide hidden sm:block">雲端測驗大師 v5.9</h1>
            <h1 className="text-xl font-bold tracking-wide sm:hidden">測驗大師</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 只有老師才顯示雙視窗 */}
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
            {/* v5.9: 顯示目前已登入狀態 */}
            {user && (
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
      {isTeacher && <TeacherDashboard questions={questions} globalSettings={globalSettings} userId={user.uid} windowId={windowId} user={user} />}
      {isStudent && <StudentDashboard questions={questions} globalSettings={globalSettings} windowId={windowId} user={user} />}
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
              if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                  await signInWithCustomToken(auth, __initial_auth_token);
              } else {
                  if (currentUser) await signOut(auth);
                  await signInAnonymously(auth);
              }
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

// --- 學生管理元件 ---
function StudentManager({ user }) {
    const [students, setStudents] = useState([]);
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [showBulk, setShowBulk] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    
    // (文字放大) 這裡將 appId 重新寫死為 v1，確保與 App 一致
    const appId = 'cloud-quiz-master-v1';

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
    }, [user]);

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
                    console.error("Import error:", err);
                    failedLines.push(`第 ${i+1} 行: 寫入失敗 (${err.code})`);
                }
            } else {
                failedLines.push(`第 ${i+1} 行: 格式無法識別`);
            }
        }

        setIsImporting(false);
        let msg = `匯入完成！\n成功：${successCount} 筆`;
        if (failedLines.length > 0) {
            msg += `\n失敗：${failedLines.length} 筆\n(請確認 Firebase 權限是否開啟)`;
        }
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
            <h3 className="font-bold text-xl mb-4 text-slate-700 flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-500"/> 學生名單管理
            </h3>
            
            {permissionError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 p-4 rounded text-rose-800 text-sm flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="w-6 h-6 shrink-0 text-rose-600" />
                    <div>
                        <strong>⚠️ 讀取權限受限 (Permission Denied)</strong>
                        <p className="mt-1">無法列出目前學生名單，但您仍可嘗試新增資料。</p>
                    </div>
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
                    <div className="text-sm text-slate-500 mb-2 p-3 bg-slate-50 rounded border border-slate-200">
                        <p className="font-bold mb-1">📝 支援格式 (每行一筆)：</p>
                        <ul className="list-disc list-inside space-y-1 ml-1">
                            <li><span className="font-mono bg-slate-200 px-1 rounded">學號 姓名</span> (空格分隔)</li>
                            <li><span className="font-mono bg-slate-200 px-1 rounded">學號,姓名</span> (逗號分隔)</li>
                            <li>Excel 直接複製貼上 (Tab分隔)</li>
                        </ul>
                    </div>
                    <textarea 
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        className="w-full h-48 border p-3 rounded text-base font-mono mb-2 outline-none focus:border-indigo-500"
                        placeholder="請在此貼上名單..."
                    />
                    <button 
                        onClick={handleBulkImport} 
                        disabled={isImporting}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded text-base font-bold hover:bg-emerald-700 transition disabled:bg-slate-300 flex justify-center items-center gap-2"
                    >
                        {isImporting ? <RefreshCcw className="w-5 h-5 animate-spin"/> : <UploadCloud className="w-5 h-5"/>}
                        {isImporting ? '處理中...' : '開始匯入'}
                    </button>
                </div>
            )}

            <div className="divide-y max-h-80 overflow-y-auto border rounded bg-white">
                {students.length === 0 && !permissionError ? (
                    <div className="p-8 text-center text-slate-400 text-base">目前無學生資料</div>
                ) : (
                    students.map(s => (
                        <div key={s.id} className="p-4 flex justify-between items-center hover:bg-slate-50 group">
                            <span className="text-base">
                                <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded mr-2 font-bold">{s.id}</span> 
                                {s.name}
                            </span>
                            <button onClick={()=>removeStudent(s.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-5 h-5"/></button>
                        </div>
                    ))
                )}
                {permissionError && (
                   <div className="p-8 text-center text-rose-300 text-base flex flex-col items-center">
                       <Lock className="w-8 h-8 mb-2 opacity-50" />
                       無法顯示列表
                   </div>
                )}
            </div>
        </div>
    );
}

function TeacherDashboard({ questions, globalSettings, userId, windowId, user }) {
  const [activeTab, setActiveTab] = useState('list'); 
  const [selectedSubject, setSelectedSubject] = useState('全部'); 
  const [editingId, setEditingId] = useState(null); 
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingLeaderboard, setViewingLeaderboard] = useState(null); 

  const safeWindowId = windowId || `teacher-${Math.random()}`;
  const appId = 'cloud-quiz-master-v1'; // v5.0 ID

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

    // 優化列印版面：使用 CSS Columns 雙欄排版
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
            
            .content-wrapper {
              column-count: 2;
              column-gap: 15px;
            }
            
            .question { 
              margin-bottom: 10px; 
              page-break-inside: avoid; 
              break-inside: avoid;
              border: 1px solid #ccc; 
              padding: 8px; 
              border-radius: 4px; 
              background: #fff; 
            }
            .q-content { font-weight: bold; margin-bottom: 5px; font-size: 11pt; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-left: 10px; font-size: 10pt; }
            .option { padding: 0; }
            .answer-section { margin-top: 8px; font-size: 9pt; color: #444; background: #f0f0f0; padding: 6px; border-radius: 4px; border-left: 3px solid #999; }
            .correct { color: #10b981; font-weight: bold; }
            .wrong { color: #ef4444; text-decoration: line-through; }
            .rationale { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc; font-size: 9pt; }
            .rationale-label { font-weight: bold; color: #d97706; }
            img { max-width: 100%; max-height: 150px; display: block; margin: 5px auto; border: 1px solid #ddd; }
            
            @media print {
              .no-print { display: none; }
              body { background: #fff; }
              .question { border: 1px solid #ddd; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>錯題複習卷</h1>
            <p>
              <strong>姓名：</strong>${result.studentName} &nbsp;|&nbsp; 
              <strong>單元：</strong>${result.unit} &nbsp;|&nbsp; 
              <strong>得分：</strong>${result.score}
            </p>
            <p style="font-size: 0.8em; color: #666;">列印時間：${new Date().toLocaleString()}</p>
          </div>

          <div class="content-wrapper">
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
    <div className="space-y-6"> {/* (文字放大) 增加間距 */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"> {/* (文字放大) text-xl */}
          <Settings className="w-6 h-6" /> 後台管理
        </h2>
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded border">
            <span className="text-sm font-bold">詳解門檻:</span> {/* (文字放大) text-sm */}
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
            { id: 'students', label: '學生管理', icon: <Users className="w-4 h-4 mr-1"/> }, // 移動到最後
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 border-b bg-slate-50 flex gap-2 overflow-x-auto">
              <button onClick={() => setSelectedSubject('全部')} className={`px-3 py-1.5 rounded-full text-sm font-bold ${selectedSubject === '全部' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}>全部</button>
              {SUBJECTS.map(s => <button key={s} onClick={() => setSelectedSubject(s)} className={`px-3 py-1.5 rounded-full text-sm font-bold ${selectedSubject === s ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}>{s}</button>)}
          </div>
          <div className="p-3 space-y-3">
            {Object.entries(filteredAndGroupedQuestions).map(([groupKey, unitQuestions]) => (
                <div key={groupKey} className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition" onClick={() => toggleUnit(groupKey)}>
                        <div className="flex items-center gap-3 text-lg font-bold text-slate-700"> {/* (文字放大) text-lg */}
                            {expandedUnits[groupKey] ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                            <Folder className="w-5 h-5 text-indigo-500" />
                            {groupKey} <span className="text-sm font-normal bg-white px-2 py-0.5 border rounded-full text-slate-500">{unitQuestions.length}題</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(groupKey, unitQuestions); }} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition"><FolderX className="w-5 h-5"/></button>
                    </div>
                    {expandedUnits[groupKey] && (
                        <div className="bg-white divide-y divide-slate-100">
                            {unitQuestions.map((q, idx) => (
                                <div key={q.id} className="p-3 flex justify-between items-start group hover:bg-indigo-50/50">
                                    <div className="flex-1 text-base pr-4"> {/* (文字放大) text-base */}
                                        <span className="text-indigo-400 font-bold mr-2">#{idx+1}</span>
                                        {q.content.substring(0, 40)}{q.content.length > 40 ? '...' : ''}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(q)} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-100 rounded-lg"><Pencil className="w-5 h-5"/></button>
                                        <button onClick={() => handleDelete(q.id)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-5 h-5"/></button>
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
                <label className="block text-sm font-bold text-slate-500">選項設定 (點選圓圈設定正確答案)</label>
                {newQuestion.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${newQuestion.correctIndex === idx ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'border-slate-300'}`}>
                        <input 
                            type="radio" 
                            name={`ans-${safeWindowId}`} 
                            checked={newQuestion.correctIndex === idx} 
                            onChange={() => setNewQuestion({...newQuestion, correctIndex: idx})} 
                            className="w-5 h-5 accent-green-600 cursor-pointer"
                        />
                        <input 
                            type="text" 
                            value={opt} 
                            onChange={e => { const n = [...newQuestion.options]; n[idx] = e.target.value; setNewQuestion({...newQuestion, options: n}); }} 
                            className="flex-1 bg-transparent outline-none text-base p-1" 
                            placeholder={`選項 ${idx+1}`} 
                        />
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

      {/* 排行榜 Modal */}
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