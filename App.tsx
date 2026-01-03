import React, { useState, useEffect, useRef } from 'react';
import { 
  getConceptExplanation, 
  getApplicationData, 
  getQuizQuestions,
  getCurriculum,
  getTopicDetail,
  getMoreQuizzes,
  getProjectDetail,
  generateDiagram
} from './services/geminiService';
import { 
  ConceptExplanation, 
  ApplicationData, 
  QuizQuestion, 
  LessonContent, 
  CurriculumTopic, 
  ProjectDetail, 
  UserProfile 
} from './types';
import { 
  initAuth, 
  saveProgress, 
  fetchProgress, 
  saveUserProfile, 
  isFirebaseActive 
} from './firebase';
import { 
  BookOpen, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Trophy,
  Rocket,
  ChevronRight,
  Monitor,
  Award,
  BookMarked,
  Layout,
  Zap,
  Cpu,
  RefreshCcw,
  Sparkles,
  Target,
  ListChecks,
  Atom,
  Mail,
  User,
  LogOut,
  Sun,
  Moon,
  Loader2,
  Menu,
  X,
  Globe,
  Key,
  Dna,
  Binary
} from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Mandarin", "Japanese", "Hindi", "Arabic", "Portuguese", "Russian"
];

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('theory2practice_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theory2practice_theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [onboardingMode, setOnboardingMode] = useState<'login' | 'signup'>('login');
  const [theory, setTheory] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'learn' | 'apply' | 'quiz' | 'teach'>('learn');
  const [userId, setUserId] = useState<string | null>(null);
  const [moduleCount, setModuleCount] = useState(5);
  const [apiKeySelected, setApiKeySelected] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English"]);
  
  const [explanation, setExplanation] = useState<ConceptExplanation | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumTopic[] | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [selectedProjectBlueprint, setSelectedProjectBlueprint] = useState<ProjectDetail | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [completedConcepts, setCompletedConcepts] = useState<string[]>([]);
  
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);

  const [quizStep, setQuizStep] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizType, setQuizType] = useState<'topic' | 'final'>('final');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theory2practice_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theory2practice_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const startApp = async () => {
      const user = await initAuth();
      if (user) {
        setUserId(user.uid);
        const progress = await fetchProgress(user.uid);
        setCompletedConcepts(progress || []);
      }
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    startApp();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  const wrapApiCall = async (fn: () => Promise<any>) => {
    try {
      return await fn();
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("API_KEY")) {
        setApiKeySelected(false);
        await handleOpenKeySelector();
      }
      throw error;
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginUsername) return;
    
    setLoginLoading(true);
    const newProfile: UserProfile = {
      email: loginEmail,
      username: loginUsername,
      languages: selectedLanguages
    };

    try {
      localStorage.setItem('theory2practice_profile', JSON.stringify(newProfile));
      if (userId) {
        await saveUserProfile(userId, newProfile);
      }
      setProfile(newProfile);
    } catch (error) {
      console.error("Auth sync failed:", error);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('theory2practice_profile');
    setTheory('');
    setExplanation(null);
    setIsMenuOpen(false);
    setOnboardingMode('login');
  };

  const handleLanguageToggle = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleInitialSearch = async (e?: React.FormEvent, overrideTheory?: string) => {
    e?.preventDefault();
    const searchTheory = overrideTheory || theory;
    if (!searchTheory.trim()) return;
    
    setLoading(true);
    try {
      const explData = await wrapApiCall(() => getConceptExplanation(searchTheory));
      setExplanation(explData);
      setCurriculum(null);
      setSelectedLesson(null);
      setApplication(null);
      setSelectedProjectBlueprint(null);
      setQuiz(null);
      setDiagramUrl(null);
      setActiveTab('learn');
      if (overrideTheory) setTheory(overrideTheory);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCurriculum = async () => {
    if (!theory.trim()) return;
    setLoading(true);
    try {
      const data = await wrapApiCall(() => getCurriculum(theory, moduleCount));
      setCurriculum(data);
      setSelectedLesson(null);
      setDiagramUrl(null);
      setActiveTab('teach');
    } catch (error) {
      console.error("Error fetching curriculum:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLesson = async (topicTitle: string) => {
    setLoading(true);
    setDiagramUrl(null);
    try {
      const data = await wrapApiCall(() => getTopicDetail(theory, topicTitle));
      setSelectedLesson(data);
    } catch (error) {
      console.error("Error fetching lesson detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTopicQuiz = () => {
    if (!selectedLesson) return;
    setQuizType('topic');
    setQuiz(selectedLesson.quizQuestions);
    setQuizStep(0);
    setQuizScore(0);
    setQuizFinished(false);
    setShowFeedback(false);
    setSelectedAnswer(null);
    setActiveTab('quiz');
  };

  const handleGenerateDiagram = async () => {
    if (!selectedLesson) return;
    setDiagramLoading(true);
    try {
      const url = await wrapApiCall(() => generateDiagram(theory, selectedLesson.topic));
      setDiagramUrl(url);
    } catch (error) {
      console.error("Error generating diagram:", error);
    } finally {
      setDiagramLoading(false);
    }
  };

  const handleViewProjectBlueprint = async (projectTitle: string) => {
    setLoading(true);
    try {
      const data = await wrapApiCall(() => getProjectDetail(theory, projectTitle));
      setSelectedProjectBlueprint(data);
    } catch (error) {
      console.error("Error fetching project blueprint:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoreQuizzes = async () => {
    if (!theory || !selectedLesson) return;
    setLoading(true);
    try {
      const data = await wrapApiCall(() => getMoreQuizzes(theory, selectedLesson.topic));
      setQuizType('topic');
      setQuiz(data);
      setQuizStep(0);
      setQuizScore(0);
      setQuizFinished(false);
      setShowFeedback(false);
      setSelectedAnswer(null);
      setActiveTab('quiz');
    } catch (error) {
      console.error("Error generating more quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFinalQuiz = async () => {
    if (!theory) return;
    setLoading(true);
    try {
      const data = await wrapApiCall(() => getQuizQuestions(theory));
      setQuizType('final');
      setQuiz(data);
      setQuizStep(0);
      setQuizScore(0);
      setQuizFinished(false);
      setShowFeedback(false);
      setSelectedAnswer(null);
      setActiveTab('quiz');
    } catch (error) {
      console.error("Error fetching quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConcept = async () => {
    if (!theory) return;
    setLoading(true);
    try {
      const data = await wrapApiCall(() => getApplicationData(theory));
      setApplication(data);
      setSelectedProjectBlueprint(null);
      setActiveTab('apply');
    } catch (error) {
      console.error("Error fetching application data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = () => {
    if (!quiz || !selectedAnswer) return;
    const currentQ = quiz[quizStep];
    const isCorrect = selectedAnswer === currentQ.correctAnswer;
    if (isCorrect) setQuizScore(prev => prev + 1);
    setShowFeedback(true);
  };

  const nextQuestion = async () => {
    if (!quiz) return;
    if (quizStep < quiz.length - 1) {
      setQuizStep(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      const scorePercentage = (quizScore / quiz.length) * 100;
      if (scorePercentage >= 80 && quizType === 'final') {
        if (!completedConcepts.includes(theory)) {
          const updated = [...completedConcepts, theory];
          setCompletedConcepts(updated);
          if (userId) await saveProgress(userId, theory);
        }
      }
      setQuizFinished(true);
    }
  };

  // ONBOARDING SCREEN (Facebook Structure)
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-12 transition-colors duration-500">
        <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div className="text-center lg:text-left space-y-4">
            <h1 className="text-6xl font-black text-[#1877f2] dark:text-indigo-400 tracking-tighter">theory2practical</h1>
            <p className="text-2xl font-medium text-slate-800 dark:text-slate-200 leading-tight max-w-lg mx-auto lg:mx-0">
              theory2practical helps you connect and share technical execution with the people in your life.
            </p>
          </div>

          <div className="w-full max-w-sm mx-auto">
            <div className="bg-white dark:bg-slate-900 p-4 pt-6 rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.1)] dark:shadow-2xl border border-transparent dark:border-slate-800 space-y-4">
              <form onSubmit={handleAuthAction} className="space-y-4">
                <input 
                  type="email" 
                  value={loginEmail} 
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email address or phone number" 
                  className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] dark:focus:border-indigo-500 transition-all text-base bg-white dark:bg-slate-950"
                  required
                />
                <input 
                  type="text" 
                  value={loginUsername} 
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Password (Username)" 
                  className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] dark:focus:border-indigo-500 transition-all text-base bg-white dark:bg-slate-950"
                  required
                />
                
                {onboardingMode === 'signup' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Skill Protocols</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGES.slice(0, 5).map(lang => (
                        <button 
                          key={lang} 
                          type="button" 
                          onClick={() => handleLanguageToggle(lang)}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition-all ${selectedLanguages.includes(lang) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="w-full bg-[#1877f2] text-white py-3 rounded-lg font-black text-xl hover:bg-[#166fe5] transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {loginLoading ? <Loader2 className="animate-spin" /> : onboardingMode === 'login' ? 'Log in' : 'Sign up'}
                </button>

                <div className="text-center">
                  <a href="#" className="text-[#1877f2] text-sm hover:underline">Forgotten password?</a>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-4 text-center">
                  <button 
                    type="button"
                    onClick={() => setOnboardingMode(onboardingMode === 'login' ? 'signup' : 'login')}
                    className="bg-[#42b72a] hover:bg-[#36a420] text-white px-5 py-3 rounded-lg font-black text-lg transition-all active:scale-95 shadow-sm"
                  >
                    {onboardingMode === 'login' ? 'Create new account' : 'Log in to existing account'}
                  </button>
                </div>
              </form>
            </div>
            <p className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-bold hover:underline cursor-pointer">Create a Page</span> for a celebrity, brand or business.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5] dark:bg-slate-950 transition-colors duration-300 animate-in fade-in duration-700">
      {!apiKeySelected && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl border border-transparent dark:border-slate-800 space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 dark:text-amber-500 mx-auto">
              <Key className="w-10 h-10" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Connection Required</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Please select a valid Gemini API key from a paid GCP project to enable AI generation.</p>
            </div>
            <button onClick={handleOpenKeySelector} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Connect API Key</button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-72 glass-sidebar border-r border-slate-200/60 dark:border-slate-800 flex flex-col h-full z-30 shrink-0 transition-colors duration-300">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-extrabold text-xl tracking-tighter">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xl shadow-indigo-100 dark:shadow-indigo-900/40"><Zap className="w-5 h-5" fill="currentColor" /></div>
            <span>Theory2Practical</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto custom-scrollbar pt-6">
          <div className="pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-3">Mastery Hub</p>
            <button onClick={() => explanation && setActiveTab('learn')} disabled={!explanation} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-xs font-bold ${activeTab === 'learn' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30'}`}><Layout className="w-4.5 h-4.5" /> Concept Node</button>
            <button onClick={() => setActiveTab('teach')} disabled={!theory} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-xs font-bold mt-1 ${activeTab === 'teach' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30'}`}><BookMarked className="w-4.5 h-4.5" /> Syllabus Architecture</button>
            <button onClick={handleApplyConcept} disabled={!explanation} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-xs font-bold mt-1 ${activeTab === 'apply' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30'}`}><Monitor className="w-4.5 h-4.5" /> Industrial Lab</button>
            <button onClick={handleStartFinalQuiz} disabled={!explanation} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-xs font-bold mt-1 ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30'}`}><CheckCircle2 className="w-4.5 h-4.5" /> Mastery Assessment</button>
          </div>
          <div className="pt-2">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-3 flex items-center justify-between"><span>Issued Certs</span><Trophy className="w-3.5 h-3.5 text-amber-500" /></p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              {completedConcepts.map((c, i) => (
                <button key={i} onClick={() => handleInitialSearch(undefined, c)} className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 transition-all group">
                  <div className="flex items-center gap-3 min-w-0"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{c}</span></div>
                  <Award className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {completedConcepts.length === 0 && (
                <div className="px-4 py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                  <Target className="w-6 h-6 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">No certifications issued</p>
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md overflow-hidden relative transition-colors duration-300">
        {/* HEADER */}
        <header className="h-20 border-b border-slate-200/60 dark:border-slate-800 flex items-center px-10 gap-6 z-20 shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-sm transition-colors duration-300">
          <form onSubmit={handleInitialSearch} className="flex-1 max-w-xl relative group">
            <input 
              type="text" 
              value={theory} 
              onChange={(e) => setTheory(e.target.value)} 
              placeholder="Analyze theoretical principle..." 
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-6 pr-6 py-3 outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all text-xs font-bold text-slate-900 dark:text-white caret-indigo-600 shadow-sm" 
            />
          </form>
          
          <div className="flex items-center gap-3 ml-auto relative" ref={menuRef}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"><Sun className="w-4 h-4" /></button>
            <button onClick={() => handleInitialSearch()} disabled={loading || !theory.trim()} className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 group">
              {loading && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
              <span>Search</span>
            </button>
            
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-3 rounded-xl border transition-all active:scale-95 ${isMenuOpen ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 p-6 z-50 animate-in slide-in-from-top-4 duration-300">
                <div className="space-y-6 flex flex-col">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg">
                      {profile.username.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{profile.username}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">{profile.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mastery Status</p>
                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{completedConcepts.length} Certificates</p>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${Math.min((completedConcepts.length / 10) * 100, 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Active Protocols</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.languages.map(lang => (
                        <span key={lang} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-indigo-100/50 dark:border-indigo-800/50">{lang}</span>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all group"
                  >
                    <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> terminal shutdown
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          <div className="max-w-6xl mx-auto h-full">
            {loading && (
              <div className="h-full flex flex-col items-center justify-center space-y-8 animate-pulse">
                <div className="w-20 h-20 relative">
                  <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900 rounded-[1.5rem]"></div>
                  <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-[1.5rem] animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Decrypting Logic Infrastructure</p>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Harnessing AI Intelligence</p>
                </div>
              </div>
            )}

            {!loading && !explanation && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-12 py-10">
                <div className="w-40 h-40 bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-float relative">
                   <div className="absolute -top-4 -right-4 w-12 h-12 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center shadow-lg"><Sparkles className="w-6 h-6" /></div>
                   <BookOpen className="w-20 h-20" />
                </div>
                <div className="space-y-4">
                  <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-[1.05]">Learn to <span className="text-indigo-600 dark:text-indigo-400">Apply.</span><br/>Not just <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-200 dark:decoration-indigo-900 decoration-8 underline-offset-8">Memorize.</span></h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed max-w-lg mx-auto">Convert abstract definitions into concrete execution blueprints and industrial use cases.</p>
                </div>
              </div>
            )}

            {!loading && activeTab === 'learn' && explanation && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-600">
                <div className="content-card p-12 relative overflow-hidden">
                  <div className="relative z-10 max-w-4xl space-y-6">
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">{theory}</h2>
                    <p className="text-xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed border-l-4 border-indigo-600 dark:border-indigo-500 pl-10 whitespace-pre-wrap">{explanation.brief}</p>
                    <div className="pt-6 flex flex-wrap gap-4">
                      <button onClick={() => setActiveTab('teach')} className="px-10 py-4.5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-4 hover:bg-indigo-700 transition-all shadow-2xl active:scale-95">Architect Roadmap <ArrowRight className="w-5 h-5" /></button>
                      <button onClick={handleApplyConcept} className="px-10 py-4.5 bg-slate-900 dark:bg-slate-800 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-4 hover:bg-black dark:hover:bg-slate-700 transition-all shadow-2xl active:scale-95">Explore Labs <Monitor className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="content-card p-10 border-t-8 border-t-emerald-500">
                    <div className="flex items-center gap-4 mb-10">
                      <Dna className="w-7 h-7 text-emerald-600" />
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">Biological Systems</h3>
                    </div>
                    <div className="grid gap-4.5">{explanation.dailyLife.living.map((item, idx) => (<div key={idx} className="flex gap-4.5 p-6 bg-emerald-50/20 dark:bg-emerald-900/10 rounded-[1.8rem] text-sm font-bold"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> {item}</div>))}</div>
                  </div>
                  <div className="content-card p-10 border-t-8 border-t-amber-500">
                    <div className="flex items-center gap-4 mb-10">
                      <Binary className="w-7 h-7 text-amber-600" />
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">Technical Systems</h3>
                    </div>
                    <div className="grid gap-4.5">{explanation.dailyLife.nonLiving.map((item, idx) => (<div key={idx} className="flex gap-4.5 p-6 bg-amber-50/20 dark:bg-amber-900/10 rounded-[1.8rem] text-sm font-bold"><CheckCircle2 className="w-6 h-6 text-amber-500 shrink-0" /> {item}</div>))}</div>
                  </div>
                </div>
              </div>
            )}

            {!loading && activeTab === 'teach' && (
              <div className="animate-in fade-in duration-600">
                {!curriculum ? (
                  <div className="max-w-4xl mx-auto py-12 space-y-12 text-center">
                    <h2 className="text-4xl font-black tracking-tighter">Configure Mastery Depth</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                      {[{ label: 'Executive', count: 3 }, { label: 'Industry', count: 5 }, { label: 'Architect', count: 10 }].map(p => (
                        <button key={p.label} onClick={() => setModuleCount(p.count)} className={`content-card p-10 text-left transition-all ${moduleCount === p.count ? 'ring-4 ring-indigo-600 border-indigo-600 shadow-lg scale-[1.02]' : ''}`}>
                          <h4 className="text-xl font-black mb-2">{p.label}</h4>
                          <div className="text-3xl font-black text-indigo-600">{p.count} Modules</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleLoadCurriculum} className="w-full max-w-2xl py-8 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-black dark:hover:bg-indigo-700 transition-all active:scale-95">Initialize Syllabus</button>
                  </div>
                ) : !selectedLesson ? (
                  <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-600">
                    <div className="flex justify-between items-end">
                      <h2 className="text-3xl font-black tracking-tighter">Roadmap: {theory}</h2>
                      <button onClick={() => setCurriculum(null)} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Reconfigure Depth</button>
                    </div>
                    <div className="grid gap-5">
                      {curriculum.map((topic, index) => (
                        <button key={topic.id} onClick={() => handleSelectLesson(topic.title)} className="flex items-center justify-between p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] hover:border-indigo-600 hover:shadow-xl transition-all text-left group">
                          <div className="flex items-center gap-12"><div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-black text-2xl text-slate-300 group-hover:text-indigo-600 transition-colors">{index + 1}</div><div><h4 className="text-xl font-black mb-2 group-hover:text-indigo-600 transition-colors">{topic.title}</h4><p className="text-slate-500 text-sm font-medium">{topic.shortDescription}</p></div></div>
                          <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 pb-20">
                    <button onClick={() => setSelectedLesson(null)} className="flex items-center gap-3 text-indigo-600 font-black text-[11px] uppercase tracking-[0.2em] bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 rounded-2xl hover:bg-indigo-100 transition-colors"><ChevronRight className="w-4 h-4 rotate-180" /> Return to Architecture</button>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 items-start">
                      <div className="xl:col-span-2 space-y-12">
                        <div className="bg-slate-900 rounded-[3rem] p-16 text-white shadow-2xl relative overflow-hidden">
                          <h3 className="text-4xl font-black tracking-tighter leading-tight relative z-10">{selectedLesson.topic}</h3>
                          <Atom className="absolute -bottom-10 -right-10 w-72 h-72 text-indigo-500/10" />
                        </div>
                        <div className="space-y-8">
                          {selectedLesson.sections.map((sec, i) => (
                            <div key={i} className="content-card p-14 space-y-8">
                              <h4 className="text-2xl font-black text-indigo-600 flex items-center gap-5"><div className="w-3 h-10 bg-indigo-600 rounded-full"></div> {sec.title}</h4>
                              <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-[2] whitespace-pre-wrap">{sec.content}</p>
                            </div>
                          ))}
                        </div>
                        <button onClick={handleStartTopicQuiz} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 hover:bg-indigo-700 transition-all active:scale-95">Initiate Assessment <ArrowRight className="w-5 h-5" /></button>
                      </div>
                      <div className="space-y-8 sticky top-10">
                        <div className="content-card p-10 bg-indigo-50/50 dark:bg-slate-900">
                          <h5 className="text-[10px] font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest mb-6">Scientific Visualization</h5>
                          <button onClick={handleGenerateDiagram} disabled={diagramLoading} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest disabled:opacity-50 shadow-md hover:shadow-lg transition-all active:scale-95">
                            {diagramLoading ? <RefreshCcw className="w-4 h-4 animate-spin mx-auto" /> : (diagramUrl ? 'Regenerate Vision' : 'Generate Diagram')}
                          </button>
                        </div>
                        {diagramUrl && <div className="content-card p-4 overflow-hidden"><img src={diagramUrl} className="w-full rounded-xl hover:scale-105 transition-transform duration-500" /></div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!loading && activeTab === 'apply' && application && (
              <div className="space-y-20 animate-in fade-in duration-600 pb-24">
                {!selectedProjectBlueprint ? (
                   <div className="grid xl:grid-cols-2 gap-12 sm:gap-20">
                    <div className="space-y-12">
                      <h2 className="text-4xl font-black tracking-tighter">Global Deployment</h2>
                      <div className="grid gap-8">{application.industryUse.map((item, idx) => (<div key={idx} className="content-card p-8 group shadow-sm"><span className="px-5 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl mb-8 inline-block tracking-widest">{item.sector}</span><p className="text-2xl font-black italic tracking-tight">"{item.purpose}"</p></div>))}</div>
                    </div>
                    <div className="space-y-12">
                      <h2 className="text-4xl font-black tracking-tighter">System Blueprints</h2>
                      <div className="grid gap-8">{application.projects.map((project, idx) => (<div