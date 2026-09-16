import React, {
  useEffect,
  useState
} from "react";

import {
  createRoot
} from "react-dom/client";

import {
  BrowserRouter
} from "react-router-dom";

import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  Languages,
  MessageCircle,
  Upload,
  LogOut,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  FileCheck2
} from "lucide-react";

import "./index.css";
import api from "./services/api";


const langs = [
  "English",
  "Tamil",
  "Hindi",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Bengali"
];


// ======================================================
// APP
// ======================================================

function App() {

  // ====================================================
  // AUTH
  // ====================================================

  const [user, setUser] =
    useState(null);

  const [mode, setMode] =
    useState("login");

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);


  // LANGUAGE
  // ====================================================

  // Saved user preference
  const [lang, setLang] =
    useState("English");

  // Currently displayed document language
  const [displayLanguage, setDisplayLanguage] =
    useState("English");


  // ====================================================
  // DOCUMENTS
  // ====================================================

  const [docs, setDocs] =
    useState([]);

  const [sel, setSel] =
    useState(null);


  // ====================================================
  // UPLOAD
  // ====================================================

  const [file, setFile] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);


  // ====================================================
  // CHAT
  // ====================================================

  const [q, setQ] =
    useState("");

  const [ans, setAns] =
    useState("");

  const [chatSources, setChatSources] =
    useState([]);

  const [loading, setLoading] =
    useState(false);


  // ====================================================
  // TRANSLATION
  // ====================================================

  const [translatingId, setTranslatingId] =
    useState(null);


  // ====================================================
  // TOAST
  // ====================================================

  const [toast, setToast] =
    useState(null);


  // ====================================================
  // NOTIFICATION
  // ====================================================

  const notify = (
    type,
    message
  ) => {

    setToast({
      type,
      message
    });

    setTimeout(
      () => {
        setToast(null);
      },
      4200
    );
  };


// ====================================================
// LOAD DOCUMENTS
// ====================================================

const load = async () => {
  try {
    const response = await api.get("/documents");

    const documents = Array.isArray(response.data)
      ? response.data
      : [];

    setDocs(documents);

    return documents;

  } catch (error) {
    console.error(
      "Failed to load documents:",
      error.response?.data || error.message
    );

    return [];
  }
};

// ====================================================
// REFRESH SELECTED DOCUMENT
// ====================================================

const refreshSelectedDocument = async () => {
  if (!sel?._id) {
    return;
  }

  try {
    const response = await api.get(
      `/documents/${sel._id}`
    );

    setSel(response.data);

  } catch (error) {
    console.error(
      "Failed to refresh selected document:",
      error.response?.data || error.message
    );
  }
};

// ====================================================
// AUTO REFRESH DOCUMENT PROCESSING
// ====================================================

useEffect(() => {
  if (!user) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      const response = await api.get("/documents");

      const updatedDocs = Array.isArray(response.data)
        ? response.data
        : [];

      setDocs(updatedDocs);

      if (sel?._id) {
        const selectedFromList = updatedDocs.find(
          document => document._id === sel._id
        );

        if (
          selectedFromList &&
          selectedFromList.status !== sel.status
        ) {
          const detail = await api.get(
            `/documents/${sel._id}`
          );

          setSel(detail.data);

          if (
            detail.data.status === "completed" &&
            sel.status !== "completed"
          ) {
            notify(
              "success",
              "Document analysis completed."
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Auto refresh failed:",
        error.response?.data || error.message
      );
    }
  }, 2500);

  return () => {
    clearInterval(interval);
  };
}, [user, sel?._id, sel?.status]);

  // ====================================================
  // CHECK LOGIN
  // ====================================================

  useEffect(() => {

    const storedUser =
      localStorage.getItem(
        "le_user"
      );

    if (!storedUser) {
      return;
    }

    try {

      const parsedUser =
        JSON.parse(
          storedUser
        );

      setUser(
        parsedUser
      );

      const preferredLanguage =
        parsedUser.preferredLanguage ||
        "English";

      setLang(
        preferredLanguage
      );

      setDisplayLanguage(
        "English"
      );

      load();

    } catch {

      localStorage.clear();

    }

  }, []);


  // Login or register

  const authSubmit =
    async (e) => {

      e.preventDefault();

      const cleanName =
        name.trim();

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const cleanPassword =
        password;

      // ----------------------------------------------
      // REGISTER VALIDATION
      // ----------------------------------------------

      if (
        mode === "register"
      ) {

        if (!cleanName) {

          notify(
            "error",
            "Please enter your name."
          );

          return;
        }

        if (!cleanEmail) {

          notify(
            "error",
            "Please enter your email."
          );

          return;
        }

        if (!cleanPassword) {

          notify(
            "error",
            "Please enter your password."
          );

          return;
        }

        if (
          cleanPassword.length < 6
        ) {

          notify(
            "error",
            "Password must be at least 6 characters."
          );

          return;
        }

      }


      // ----------------------------------------------
      // LOGIN VALIDATION
      // ----------------------------------------------

      if (
        mode === "login"
      ) {

        if (
          !cleanEmail ||
          !cleanPassword
        ) {

          notify(
            "error",
            "Please enter your email and password."
          );

          return;
        }

      }


      try {

        const response =
          await api.post(

            mode === "login"
              ? "/auth/login"
              : "/auth/register",

            mode === "register"
              ? {
                  name:
                    cleanName,

                  email:
                    cleanEmail,

                  password:
                    cleanPassword,

                  preferredLanguage:
                    lang ||
                    "English"
                }
              : {
                  email:
                    cleanEmail,

                  password:
                    cleanPassword
                }

          );


        // ------------------------------------------
        // SAVE SESSION
        // ------------------------------------------

        localStorage.setItem(
          "le_token",
          response.data.token
        );

        localStorage.setItem(
          "le_user",
          JSON.stringify(
            response.data.user
          )
        );


        setUser(
          response.data.user
        );

        setLang(
          response.data.user
            ?.preferredLanguage ||
          lang ||
          "English"
        );

        setDisplayLanguage(
          "English"
        );


        notify(
          "success",
          mode === "login"
            ? "Welcome back to LegalEase."
            : "Account created successfully."
        );


        await load();

      } catch (error) {

        console.error(
          "Authentication error:",
          error.response?.data ||
          error.message
        );

        notify(
          "error",
          error.response?.data?.message ||
          "Authentication failed."
        );

      }

    };


  // Upload PDF

  const up = async () => {
    if (!file) {
      notify(
        "warning",
        "Please select a PDF first."
      );
      return;
    }

    if (file.type !== "application/pdf") {
      notify(
        "error",
        "Only PDF files are supported."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify(
        "warning",
        "Maximum file size is 10 MB."
      );
      return;
    }

    const formData = new FormData();

    formData.append(
      "document",
      file
    );

    try {
      setUploading(true);

      const response = await api.post(
        "/documents/upload",
        formData
      );

      const uploadedDocument =
        response.data?.document ||
        response.data?.data ||
        null;

      setFile(null);

      // Automatically select the newly uploaded document.
      if (uploadedDocument?._id) {
        setSel(uploadedDocument);
        setDisplayLanguage("English");
        setTranslatingId(null);
        setAns("");
        setChatSources([]);
      }

      await load();

      notify(
        "success",
        "Document uploaded. AI analysis has started."
      );

    } catch (error) {
      console.error(
        "Upload error:",
        error.response?.data ||
        error.message
      );

      notify(
        "error",
        error.response?.data?.message ||
        "Upload failed."
      );

    } finally {
      setUploading(false);
    }
  };


  // Open document

  const open =
    async (id) => {

      try {

        setLoading(
          true
        );

        const response =
          await api.get(
            `/documents/${id}`
          );

        setSel(
          response.data
        );

        setDisplayLanguage(
          "English"
        );

        if (translatingId === id) {
          setTranslatingId(null);
        }

        setAns(
          ""
        );

        setChatSources(
          []
        );

      } catch (error) {

        notify(
          "error",
          error.response?.data?.message ||
          "Unable to open document."
        );

      } finally {

        setLoading(
          false
        );

      }

    };


  // Change document language

  const viewLanguage =
    async (
      targetLanguage
    ) => {

      if (!sel) {
        return;
      }


      // ----------------------------------------------
      // ENGLISH
      // ----------------------------------------------

      if (
        targetLanguage ===
        "English"
      ) {

        try {

          setLoading(
            true
          );

          const response =
            await api.get(
              `/documents/${sel._id}`
            );

          setSel(
            response.data
          );

          setDisplayLanguage(
            "English"
          );

          setAns(
            ""
          );

          setChatSources(
            []
          );

        } catch (error) {

          notify(
            "error",
            error.response?.data?.message ||
            "Unable to load English."
          );

        } finally {

          setLoading(
            false
          );

        }

        return;
      }


      // ----------------------------------------------
      // OTHER LANGUAGE
      // ----------------------------------------------

      try {

        const documentId = sel._id;
        setTranslatingId(documentId);

        const response =
          await api.post(
            `/documents/${sel._id}/translate`,
            {
              language:
                targetLanguage
            }
          );

        setSel(previous => ({
          ...previous,
          summary: response.data?.summary ?? previous.summary,
          clauses: Array.isArray(response.data?.clauses)
            ? response.data.clauses
            : previous.clauses,
          risks: Array.isArray(response.data?.risks)
            ? response.data.risks
            : previous.risks,
          missingClauses: Array.isArray(response.data?.missingClauses)
            ? response.data.missingClauses
            : previous.missingClauses,
          language: response.data?.language || targetLanguage,
          documentType: previous.documentType,
          riskScore: previous.riskScore,
          riskLevel: previous.riskLevel,
          healthReport: previous.healthReport,
          pageCount: previous.pageCount,
          status: previous.status,
          filename: previous.filename,
          confidence: previous.confidence
        }));

        setDisplayLanguage(
          targetLanguage
        );

        setAns(
          ""
        );

        setChatSources(
          []
        );

      } catch (error) {

        notify(
          "error",
          error.response?.data?.message ||
          "Translation failed."
        );

      } finally {

        setTranslatingId(null);

      }

    };


  // Ask document question

  const ask =
    async () => {

      if (
        !q.trim() ||
        !sel
      ) {
        return;
      }


      try {

        setLoading(
          true
        );

        const response =
          await api.post(
            "/chat",
            {
              documentId:
                sel._id,

              question:
                q.trim(),

              language:
                displayLanguage
            }
          );


        setAns(
          response.data.answer ||
          ""
        );


        setChatSources(
          Array.isArray(
            response.data.sources
          )
            ? response.data.sources
            : []
        );


        setQ(
          ""
        );

      } catch (error) {

        notify(
          "error",
          error.response?.data?.message ||
          "Chat failed."
        );

      } finally {

        setLoading(
          false
        );

      }

    };


  // Logout

  const logout =
    () => {

      localStorage.removeItem(
        "le_token"
      );

      localStorage.removeItem(
        "le_user"
      );

      setUser(
        null
      );

      setDocs(
        []
      );

      setSel(
        null
      );

      setLang(
        "English"
      );

      setDisplayLanguage(
        "English"
      );

      setTranslatingId(null);

      setFile(
        null
      );

      setQ(
        ""
      );

      setAns(
        ""
      );

      setChatSources(
        []
      );

    };


  // ====================================================
  // RISK COLOR
  // ====================================================

  const riskClass =
    (risk) => {

      if (
        risk === "High"
      ) {

        return (
          "bg-red-100 text-red-700"
        );

      }


      if (
        risk === "Medium"
      ) {

        return (
          "bg-yellow-100 text-yellow-700"
        );

      }


      return (
        "bg-green-100 text-green-700"
      );

    };


  // ====================================================
  // HEALTH LEVEL COLOR
  // ====================================================

  const healthClass =
    (level) => {

      if (
        level === "Good"
      ) {

        return (
          "bg-emerald-50 text-emerald-700"
        );

      }

      if (
        level === "Moderate"
      ) {

        return (
          "bg-amber-50 text-amber-700"
        );

      }

      return (
        "bg-red-50 text-red-700"
      );

    };


  // ====================================================
  // LOGIN / REGISTER SCREEN
  // ====================================================

  if (!user) {

    return (

      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">

        <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-[2rem] overflow-hidden shadow-2xl">


          {/* ============================================
              LEFT PANEL
          ============================================ */}

          <div className="hidden lg:flex bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-12 text-white flex-col justify-between">

            <div>

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">

                  <ShieldCheck
                    size={26}
                  />

                </div>

                <div>

                  <div className="text-xl font-bold">
                    LegalEase
                  </div>

                  <div className="text-xs text-indigo-100">
                    AI-powered legal literacy
                  </div>

                </div>

              </div>


              <div className="mt-20">

                <p className="text-indigo-100 text-sm font-semibold mb-3">
                  UNDERSTAND WITH CONFIDENCE
                </p>

                <h2 className="text-4xl font-bold leading-tight">
                  Make complex legal documents easier to understand.
                </h2>

                <p className="text-indigo-100 mt-5 leading-7 max-w-md">
                  Upload a document and get a simple summary,
                  key clauses, potential risks, completeness
                  insights and document-based AI answers.
                </p>

              </div>

            </div>


            <div className="grid grid-cols-3 gap-3">

              {[
                [
                  "AI",
                  "Document analysis"
                ],
                [
                  "8+",
                  "Languages"
                ],
                [
                  "24/7",
                  "AI Q&A"
                ]
              ].map(
                ([value, label]) => (

                  <div
                    key={label}
                    className="rounded-2xl bg-white/10 border border-white/10 p-4"
                  >

                    <div className="font-bold text-lg">
                      {value}
                    </div>

                    <div className="text-indigo-100 text-xs mt-1">
                      {label}
                    </div>

                  </div>

                )
              )}

            </div>

          </div>


          {/* ============================================
              RIGHT PANEL
          ============================================ */}

          <div className="p-7 sm:p-10 lg:p-12">

            <div className="lg:hidden flex items-center gap-3 mb-9">

              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">

                <ShieldCheck
                  size={26}
                />

              </div>

              <div>

                <h1 className="text-xl font-bold text-slate-900">
                  LegalEase
                </h1>

                <p className="text-xs text-slate-500">
                  AI-powered legal literacy
                </p>

              </div>

            </div>


            <div className="mb-8">

              <p className="text-sm font-semibold text-indigo-600">

                {mode === "login"
                  ? "WELCOME BACK"
                  : "GET STARTED"}

              </p>


              <h1 className="text-3xl font-bold text-slate-900 mt-2">

                {mode === "login"
                  ? "Sign in to LegalEase"
                  : "Create your account"}

              </h1>


              <p className="text-slate-500 mt-2">

                {mode === "login"
                  ? "Continue understanding your legal documents."
                  : "Start turning complex legal language into plain information."}

              </p>

            </div>


            <form
              onSubmit={
                authSubmit
              }
              className="space-y-4"
            >


              {/* NAME */}

              {mode === "register" && (

                <div>

                  <label className="text-sm font-semibold text-slate-700">
                    Full name
                  </label>

                  <input
                    className="w-full mt-1.5 border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    placeholder="Enter your name"
                    value={name}
                    onChange={
                      (e) =>
                        setName(
                          e.target.value
                        )
                    }
                    required
                  />

                </div>

              )}


              {/* EMAIL */}

              <div>

                <label className="text-sm font-semibold text-slate-700">
                  Email
                </label>

                <input
                  className="w-full mt-1.5 border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={
                    (e) =>
                      setEmail(
                        e.target.value
                      )
                  }
                  required
                />

              </div>


              {/* PASSWORD */}

              <div>

                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative mt-1.5">

                  <input
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pr-12 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={
                      (e) =>
                        setPassword(
                          e.target.value
                        )
                    }
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >

                    {showPassword
                      ? <EyeOff size={18} />
                      : <Eye size={18} />
                    }

                  </button>

                </div>

              </div>


              {/* LANGUAGE */}

              {mode === "register" && (

                <div>

                  <label className="text-sm font-semibold text-slate-700">
                    Preferred language
                  </label>

                  <select
                    className="w-full mt-1.5 border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    value={lang}
                    onChange={
                      (e) =>
                        setLang(
                          e.target.value
                        )
                    }
                  >

                    {langs.map(
                      language => (

                        <option
                          key={language}
                          value={language}
                        >
                          {language}
                        </option>

                      )
                    )}

                  </select>

                  <p className="text-xs text-slate-400 mt-2">
                    Your documents can be translated into this language.
                  </p>

                </div>

              )}


              {/* SUBMIT */}

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
              >

                {mode === "login"
                  ? "Sign in"
                  : "Create account"}

              </button>

            </form>


            <div className="relative my-7">

              <div className="border-t border-slate-100" />

              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-3 text-xs text-slate-400">

                {mode === "login"
                  ? "New to LegalEase?"
                  : "Already registered?"}

              </span>

            </div>


            <button
              type="button"
              className="w-full border border-slate-200 text-slate-700 rounded-xl py-3 font-semibold hover:bg-slate-50 transition"
              onClick={() =>
                setMode(
                  mode === "login"
                    ? "register"
                    : "login"
                )
              }
            >

              {mode === "login"
                ? "Create an account"
                : "Sign in instead"}

            </button>


            <p className="text-[11px] text-slate-400 text-center mt-7 leading-5">
              LegalEase provides informational assistance
              and is not a substitute for professional
              legal advice.
            </p>

          </div>

        </div>

      </div>

    );

  }


  // ====================================================
  // DASHBOARD COUNTERS
  // ====================================================

  const completedDocs =
    docs.filter(
      d =>
        d.status ===
        "completed"
    ).length;


  const highRiskDocs =
    docs.filter(
      d =>
        d.riskLevel ===
        "High"
    ).length;


  const missingClauseDocs =
    docs.filter(
      d =>
        (d.missingClauses ||
          []).some(
            item =>
              item.status ===
              "Not Found"
          )
    ).length;


  // ====================================================
  // MAIN
  // ====================================================

  const selectedRiskScore =
    sel && sel.status === "completed"
      ? Number.isFinite(Number(sel.riskScore))
        ? Number(sel.riskScore)
        : null
      : null;

  return (

    <div className="min-h-screen bg-slate-50">


      {/* =================================================
          TOAST
      ================================================= */}

      {toast && (

        <div className="fixed top-5 right-5 z-50 max-w-sm">

          <div
            className={`flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-xl ${
              toast.type ===
              "error"
                ? "border-red-200"
                : toast.type ===
                  "warning"
                ? "border-amber-200"
                : "border-emerald-200"
            }`}
          >

            {toast.type ===
            "error" ? (

              <XCircle
                className="text-red-500 mt-0.5"
                size={19}
              />

            ) : toast.type ===
              "warning" ? (

              <AlertTriangle
                className="text-amber-500 mt-0.5"
                size={19}
              />

            ) : (

              <CheckCircle2
                className="text-emerald-500 mt-0.5"
                size={19}
              />

            )}

            <p className="text-sm font-medium text-slate-700">
              {toast.message}
            </p>

          </div>

        </div>

      )}


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-[72px] flex justify-between items-center">


          {/* LOGO */}

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">

              <ShieldCheck
                size={23}
              />

            </div>

            <div>

              <div className="font-bold text-lg text-slate-900">
                LegalEase
              </div>

              <div className="hidden sm:block text-[11px] text-slate-400">
                Legal document intelligence
              </div>

            </div>

          </div>


          {/* HEADER RIGHT */}

          <div className="flex items-center gap-2 sm:gap-4">

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">

              <Languages
                size={16}
                className="text-indigo-600"
              />

              <div>

                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Preferred language
                </div>

                <div className="text-sm font-semibold text-slate-700">
                  {user.preferredLanguage ||
                    "English"}
                </div>

              </div>

            </div>


            <div className="hidden sm:block text-right">

              <div className="text-sm font-semibold text-slate-800">
                {user.name}
              </div>

              <div className="text-[11px] text-slate-400">
                {user.email}
              </div>

            </div>


            <button
              onClick={logout}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
              title="Logout"
            >

              <LogOut
                size={18}
              />

            </button>

          </div>

        </div>

      </header>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8">


        {/* =================================================
            INTRO
        ================================================= */}

        <section className="mb-8">

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">

            <div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-4">

                <Sparkles
                  size={14}
                />

                AI-POWERED LEGAL LITERACY

              </div>


              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Your legal document workspace
              </h1>


              <p className="text-slate-500 mt-2 max-w-3xl leading-6">
                Understand complex documents through
                plain-language summaries, key clauses,
                potential risks, missing-clause detection,
                document health insights and page-aware AI answers.
              </p>

            </div>


            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-4 py-3 rounded-2xl">

              <CheckCircle2
                size={15}
                className="text-emerald-500"
              />

              Your documents stay in your workspace

            </div>

          </div>

        </section>


        {/* =================================================
            DASHBOARD CARDS
        ================================================= */}

        <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">

          {[
            {
              icon:
                FileText,

              label:
                "Total documents",

              value:
                docs.length,

              helper:
                `${completedDocs} completed`
            },

            {
              icon:
                AlertTriangle,

              label:
                "High risk",

              value:
                highRiskDocs,

              helper:
                "Documents needing attention"
            },

            {
              icon:
                AlertTriangle,

              label:
                "Missing clauses",

              value:
                missingClauseDocs,

              helper:
                "Documents with gaps"
            },

            {
              icon:
                Languages,

              label:
                "Preferred language",

              value:
                user.preferredLanguage ||
                "English",

              helper:
                "Used for translation"
            },

            {
              icon:
                MessageCircle,

              label:
                "AI Q&A",

              value:
                "Ready",

              helper:
                "Page-aware answers"
            }

          ].map(
            ({
              icon: Icon,
              label,
              value,
              helper
            }) => (

              <div
                key={label}
                className="bg-white border border-slate-200 rounded-2xl p-5"
              >

                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">

                  <Icon
                    size={19}
                  />

                </div>

                <p className="text-sm text-slate-500">
                  {label}
                </p>

                <div className="font-bold text-xl text-slate-900 mt-1 truncate">
                  {value}
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  {helper}
                </p>

              </div>

            )
          )}

        </section>


        {/* =================================================
            UPLOAD
        ================================================= */}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 mb-8 shadow-sm">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">

            <div className="flex items-start gap-3">

              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">

                <Upload
                  size={20}
                />

              </div>

              <div>

                <h2 className="font-bold text-lg text-slate-900">
                  Analyze a new document
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Upload a PDF to extract legal insights using AI.
                </p>

              </div>

            </div>


            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-full">

              <FileCheck2
                size={14}
              />

              PDF · Max 10 MB

            </div>

          </div>


          <div className="rounded-2xl bg-slate-50 p-5 sm:p-7">

            <div className="flex flex-col lg:flex-row gap-4 items-center">

              <div className="flex-1 w-full">

                <label className="block cursor-pointer">

                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={
                      e =>
                        setFile(
                          e.target.files?.[0] ||
                          null
                        )
                    }
                  />

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:border-indigo-300 transition">

                    <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">

                      <FileText
                        size={23}
                      />

                    </div>

                    <div className="min-w-0">

                      <p className="font-semibold text-slate-800 truncate">

                        {file
                          ? file.name
                          : "Choose a PDF document"}

                      </p>

                      <p className="text-xs text-slate-400 mt-1">

                        {file
                          ? `${(
                              file.size /
                              1024 /
                              1024
                            ).toFixed(2)} MB selected`
                          : "Click here to browse your files"}

                      </p>

                    </div>

                  </div>

                </label>

              </div>


              <button
                onClick={up}
                disabled={
                  uploading
                }
                className="w-full lg:w-auto bg-indigo-600 text-white rounded-xl px-7 py-3.5 flex items-center justify-center gap-2 font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50"
              >

                {uploading ? (

                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    Uploading...

                  </>

                ) : (

                  <>
                    <Sparkles
                      size={18}
                    />

                    Analyze document

                  </>

                )}

              </button>

            </div>


            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-xs text-slate-500">

              {[
                "Plain-language summary",
                "Key clauses",
                "Potential risks",
                "Missing clauses",
                "Document health"
              ].map(
                feature => (

                  <span
                    key={feature}
                    className="flex items-center gap-1.5"
                  >

                    <CheckCircle2
                      size={13}
                      className="text-emerald-500"
                    />

                    {feature}

                  </span>

                )
              )}

            </div>

          </div>

        </section>


        {/* =================================================
            DOCUMENT WORKSPACE
        ================================================= */}

        <div className="grid xl:grid-cols-[340px_1fr] gap-6 items-start">


          {/* =================================================
              DOCUMENT LIST
          ================================================= */}

          <aside className="bg-white border border-slate-200 rounded-3xl p-5 xl:sticky xl:top-24">

            <div className="flex items-center justify-between mb-5">

              <div>

                <h2 className="font-bold text-lg text-slate-900">
                  My documents
                </h2>

                <p className="text-xs text-slate-400 mt-1">
                  {docs.length} document
                  {docs.length === 1
                    ? ""
                    : "s"}
                </p>

              </div>

              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">

                <FileText
                  size={17}
                />

              </div>

            </div>


            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">

              {docs.map(
                d => {

                  const selected =
                    sel?._id ===
                    d._id;

                  const risk =
                    d.riskLevel ||
                    "Low";

                  const missing =
                    (d.missingClauses ||
                      []).filter(
                        item =>
                          item.status ===
                          "Not Found"
                      ).length;


                  return (

                    <button
                      key={d._id}
                      onClick={() =>
                        open(
                          d._id
                        )
                      }
                      className={`w-full text-left rounded-2xl p-4 border transition ${
                        selected
                          ? "border-indigo-300 bg-indigo-50/70"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >

                      <div className="flex gap-3">

                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-white text-indigo-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >

                          <FileText
                            size={18}
                          />

                        </div>


                        <div className="min-w-0 flex-1">

                          <div className="flex justify-between gap-2 items-start">

                            <p className="font-semibold text-sm text-slate-800 truncate">
                              {d.filename}
                            </p>


                            {d.status ===
                            "completed" ? (

                              <CheckCircle2
                                size={15}
                                className="text-emerald-500 shrink-0"
                              />

                            ) : (

                              <Loader2
                                size={15}
                                className="text-indigo-500 animate-spin shrink-0"
                              />

                            )}

                          </div>


                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {d.documentType ||
                              "Unknown document"}
                          </p>


                          <div className="flex flex-wrap items-center gap-2 mt-3">

                            {d.riskScore !==
                              undefined && (

                              <span
                                className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                  risk === "High"
                                    ? "bg-red-50 text-red-600"
                                    : risk === "Medium"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}
                              >
                                {risk}
                              </span>

                            )}


                            {missing >
                              0 && (

                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">

                                {missing}
                                {" "}
                                missing

                              </span>

                            )}

                          </div>

                        </div>

                      </div>

                    </button>

                  );

                }
              )}


              {!docs.length && (

                <div className="text-center py-12 px-4">

                  <div className="w-14 h-14 rounded-2xl bg-slate-50 mx-auto flex items-center justify-center text-slate-300">

                    <FileText
                      size={25}
                    />

                  </div>

                  <p className="font-semibold text-slate-600 mt-4">
                    No documents yet
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Upload your first PDF to begin.
                  </p>

                </div>

              )}

            </div>

          </aside>


          {/* =================================================
              DOCUMENT CONTENT
          ================================================= */}

          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 min-w-0">


            {!sel ? (

              <div className="min-h-[560px] flex flex-col items-center justify-center text-center px-5">

                <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center">

                  <FileCheck2
                    size={34}
                  />

                </div>

                <h2 className="text-xl font-bold text-slate-800 mt-6">
                  Select a document
                </h2>

                <p className="text-sm text-slate-400 mt-2 max-w-md leading-6">
                  Choose a document from the list to view
                  its AI summary, health report, missing clauses,
                  risks and page-aware AI answers.
                </p>

              </div>

            ) : (

              <div>


                {/* =================================================
                    DOCUMENT HEADER
                ================================================= */}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-6 border-b border-slate-100">

                  <div className="flex gap-4 min-w-0">

                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">

                      <FileText
                        size={23}
                      />

                    </div>

                    <div className="min-w-0">

                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                        {sel.filename}
                      </h2>

                      <div className="flex flex-wrap gap-2 mt-2">

                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                          {sel.documentType ||
                            "Unknown"}
                        </span>

                        {sel.pageCount ? (

                          <span className="text-xs text-slate-400 flex items-center gap-1">

                            <FileText
                              size={12}
                            />

                            {sel.pageCount}
                            {" "}
                            pages

                          </span>

                        ) : null}

                      </div>

                    </div>

                  </div>


                  <div className="flex items-center gap-4 shrink-0">

                    <div>

                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Risk score
                      </p>

                      <div className="flex items-end gap-1 mt-1">

                        <span className="text-3xl font-bold text-slate-900">
                          {selectedRiskScore ?? "—"}
                        </span>

                        <span className="text-xs text-slate-400 mb-1">
                          /100
                        </span>

                      </div>

                    </div>


                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        sel.riskLevel ===
                        "High"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : sel.riskLevel ===
                            "Medium"
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      }`}
                    >
                      {sel.riskLevel ||
                        "Low"}
                    </span>

                  </div>

                </div>


                {/* =================================================
                    LANGUAGE CONTROLS
                ================================================= */}

                <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                    <div className="flex items-start gap-3">

                      <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center shadow-sm">

                        <Languages
                          size={18}
                        />

                      </div>

                      <div>

                        <p className="text-sm font-bold text-slate-900">
                          Document language
                        </p>

                        <p className="text-xs text-slate-500 mt-1">
                          Currently viewing in{" "}
                          <span className="font-semibold text-indigo-600">
                            {displayLanguage}
                          </span>
                        </p>

                      </div>

                    </div>


                    <div className="flex flex-col sm:flex-row gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          viewLanguage(
                            user.preferredLanguage ||
                            "English"
                          )
                        }
                        disabled={
                          translatingId === sel?._id ||
                          displayLanguage ===
                            (
                              user.preferredLanguage ||
                              "English"
                            )
                        }
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                      >

                        {translatingId === sel?._id ? (

                          <>
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                            Translating...
                          </>

                        ) : (

                          <>
                            <Languages
                              size={16}
                            />

                            View in{" "}
                            {user.preferredLanguage ||
                              "English"}

                          </>

                        )}

                      </button>


                      <select
                        value=""
                        onChange={
                          e => {

                            const selected =
                              e.target.value;

                            if (
                              selected
                            ) {

                              viewLanguage(
                                selected
                              );

                            }

                          }
                        }
                        disabled={
                          translatingId === sel?._id
                        }
                        className="border border-slate-200 bg-white text-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium"
                      >

                        <option value="">
                          Other language
                        </option>

                        {langs
                          .filter(
                            language =>
                              language !==
                              displayLanguage
                          )
                          .map(
                            language => (

                              <option
                                key={
                                  language
                                }
                                value={
                                  language
                                }
                              >
                                {language}
                              </option>

                            )
                          )}

                      </select>

                    </div>

                  </div>

                </div>


                {/* =================================================
                    AI SUMMARY
                ================================================= */}

                <div className="mt-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 sm:p-6">

                  <div className="flex items-center gap-3 mb-3">

                    <div className="w-9 h-9 rounded-xl bg-white text-indigo-600 flex items-center justify-center shadow-sm">

                      <Sparkles
                        size={17}
                      />

                    </div>

                    <div>

                      <h3 className="font-bold text-slate-900">
                        AI Summary
                      </h3>

                      <p className="text-[11px] text-indigo-500">
                        Plain-language overview
                      </p>

                    </div>

                  </div>


                  <p className="text-sm sm:text-[15px] text-slate-600 leading-7 whitespace-pre-line">
                    {sel.summary ||
                      "Processing your document..."}
                  </p>

                </div>


                {/* =================================================
                    BASIC STATS
                ================================================= */}

                <div className="grid sm:grid-cols-4 gap-3 mt-5">

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                    <p className="text-xs text-slate-400">
                      Key clauses
                    </p>

                    <p className="font-bold text-xl mt-1 text-slate-800">
                      {(sel.clauses ||
                        []).length}
                    </p>

                  </div>


                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                    <p className="text-xs text-slate-400">
                      Potential risks
                    </p>

                    <p className="font-bold text-xl mt-1 text-slate-800">
                      {(sel.risks ||
                        []).length}
                    </p>

                  </div>


                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                    <p className="text-xs text-slate-400">
                      Missing clauses
                    </p>

                    <p className="font-bold text-xl mt-1 text-slate-800">
                      {(sel.missingClauses ||
                        []).filter(
                          item =>
                            item.status ===
                            "Not Found"
                        ).length}
                    </p>

                  </div>


                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                    <p className="text-xs text-slate-400">
                      Analysis status
                    </p>

                    <p className="font-bold text-sm mt-2 text-emerald-600 flex items-center gap-1.5">

                      <CheckCircle2
                        size={15}
                      />

                      {sel.status ||
                        "Completed"}

                    </p>

                  </div>

                </div>


                {/* =================================================
                    DOCUMENT HEALTH REPORT
                ================================================= */}

                {sel.healthReport && (

                  <div className="mt-8">

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">

                      <div>

                        <h3 className="text-lg font-bold text-slate-900">
                          Document Health Report
                        </h3>

                        <p className="text-xs text-slate-400 mt-1">
                          Project-defined overview of risk and document completeness.
                        </p>

                      </div>

                      <span
                        className={`self-start px-3 py-1.5 rounded-full text-xs font-bold ${healthClass(
                          sel.healthReport
                            .healthLevel
                        )}`}
                      >
                        {sel.healthReport
                          .healthLevel ||
                          "Good"}
                      </span>

                    </div>


                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">


                      {/* OVERALL */}

                      <div className="rounded-2xl border border-slate-200 p-4 bg-white">

                        <p className="text-xs text-slate-400">
                          Overall health
                        </p>

                        <div className="flex items-end gap-1 mt-1">

                          <span className="text-2xl font-bold text-slate-900">

                            {sel.healthReport
                              .overallScore ??
                              0}

                          </span>

                          <span className="text-xs text-slate-400 mb-1">
                            /100
                          </span>

                        </div>

                      </div>


                      {/* COMPLETENESS */}

                      <div className="rounded-2xl border border-slate-200 p-4 bg-white">

                        <p className="text-xs text-slate-400">
                          Completeness
                        </p>

                        <div className="flex items-end gap-1 mt-1">

                          <span className="text-2xl font-bold text-slate-900">

                            {sel.healthReport
                              .completenessScore ??
                              0}

                          </span>

                          <span className="text-xs text-slate-400 mb-1">
                            %
                          </span>

                        </div>

                      </div>


                      {/* MISSING */}

                      <div className="rounded-2xl border border-slate-200 p-4 bg-white">

                        <p className="text-xs text-slate-400">
                          Missing clauses
                        </p>

                        <p className="text-2xl font-bold text-slate-900 mt-1">

                          {sel.healthReport
                            .missingClauseCount ??
                            0}

                        </p>

                      </div>


                      {/* HIGH RISK */}

                      <div className="rounded-2xl border border-slate-200 p-4 bg-white">

                        <p className="text-xs text-slate-400">
                          High risks
                        </p>

                        <p className="text-2xl font-bold text-slate-900 mt-1">

                          {sel.healthReport
                            .highRiskCount ??
                            0}

                        </p>

                      </div>

                    </div>


                    {/* RISK BREAKDOWN */}

                    <div className="grid sm:grid-cols-3 gap-3 mt-3">

                      <div className="rounded-2xl bg-red-50 border border-red-100 p-4">

                        <p className="text-xs text-red-500 font-semibold">
                          High
                        </p>

                        <p className="text-xl font-bold text-red-700 mt-1">
                          {sel.healthReport
                            .highRiskCount ??
                            0}
                        </p>

                      </div>


                      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">

                        <p className="text-xs text-amber-500 font-semibold">
                          Medium
                        </p>

                        <p className="text-xl font-bold text-amber-700 mt-1">
                          {sel.healthReport
                            .mediumRiskCount ??
                            0}
                        </p>

                      </div>


                      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">

                        <p className="text-xs text-emerald-500 font-semibold">
                          Low
                        </p>

                        <p className="text-xl font-bold text-emerald-700 mt-1">
                          {sel.healthReport
                            .lowRiskCount ??
                            0}
                        </p>

                      </div>

                    </div>


                    {/* TOP CONCERNS */}

                    {Array.isArray(
                      sel.healthReport
                        .topConcerns
                    ) &&
                    sel.healthReport
                      .topConcerns
                      .length > 0 && (

                      <div className="mt-4 rounded-2xl border border-slate-200 p-5">

                        <div className="flex items-center gap-2">

                          <AlertTriangle
                            size={16}
                            className="text-amber-500"
                          />

                          <p className="text-sm font-bold text-slate-900">
                            Top concerns
                          </p>

                        </div>


                        <div className="mt-3 space-y-2">

                          {sel.healthReport
                            .topConcerns
                            .map(
                              (
                                item,
                                index
                              ) => (

                                <div
                                  key={
                                    index
                                  }
                                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                                >

                                  <div className="flex items-center gap-2 min-w-0">

                                    <span className="text-sm text-slate-700 truncate">
                                      {item.title}
                                    </span>

                                  </div>


                                  <div className="flex items-center gap-2 shrink-0">

                                    {item.type && (

                                      <span className="text-[10px] font-semibold text-slate-400">
                                        {item.type ===
                                        "missingClause"
                                          ? "Missing clause"
                                          : "Risk"}
                                      </span>

                                    )}

                                    {item.pageNumber && (

                                      <span className="text-[11px] text-slate-400">
                                        Page{" "}
                                        {
                                          item.pageNumber
                                        }
                                      </span>

                                    )}

                                  </div>

                                </div>

                              )
                            )}

                        </div>

                      </div>

                    )}

                  </div>

                )}


               {/* =================================================
    MISSING CLAUSE DETECTION
================================================= */}

<div className="mt-8">

  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">

    <div>

      <h3 className="text-lg font-bold text-slate-900">
        Missing Clause Detection
      </h3>

      <p className="text-xs text-slate-400 mt-1">
        Document-type-specific checks. Only clauses that were not clearly detected are shown here.
      </p>

    </div>


    <span className="text-xs font-semibold text-slate-400">

      {(sel.missingClauses || []).filter(
        item =>
          item.status === "Not Found"
      ).length}

      {" "}
      missing

    </span>

  </div>


  {/* =================================================
      ONLY NOT FOUND CLAUSES
  ================================================= */}

  {(() => {

    const missingItems =
      (sel.missingClauses || []).filter(
        item =>
          item.status === "Not Found"
      );


    if (missingItems.length === 0) {

      return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">

          <div className="flex items-start gap-3">

            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">

              <CheckCircle2
                size={19}
              />

            </div>


            <div>

              <p className="font-bold text-sm text-emerald-800">
                No missing clauses detected
              </p>

              <p className="text-sm text-emerald-700 mt-1 leading-6">
                All expected document-specific clauses were found by the current checklist.
              </p>

            </div>

          </div>

        </div>
      );

    }


    return (
      <div className="space-y-3">

        {missingItems.map(
          (
            item,
            index
          ) => (

            <div
              key={
                `${item.title}-${index}`
              }
              className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4"
            >

              <div className="flex items-start gap-3">

                {/* ICON */}

                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">

                  <AlertTriangle
                    size={17}
                  />

                </div>


                {/* CONTENT */}

                <div className="flex-1 min-w-0">

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">

                    <h4 className="font-bold text-sm text-slate-900">
                      {item.title}
                    </h4>


                    <div className="flex gap-2 shrink-0">

                      {/* STATUS */}

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                        Not Found
                      </span>


                      {/* IMPORTANCE */}

                      {item.importance && (

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${riskClass(
                            item.importance
                          )}`}
                        >
                          {item.importance}
                        </span>

                      )}

                    </div>

                  </div>


                  <p className="text-sm text-slate-600 leading-6 mt-2">

                    {item.description ||
                      `No clear related content for "${item.title}" was found in the document.`}

                  </p>

                </div>

              </div>

            </div>

          )
        )}

      </div>
    );

  })()}

</div>

                {/* =================================================
                    KEY CLAUSES
                ================================================= */}

                <div className="mt-8">

                  <div className="flex items-end justify-between mb-4">

                    <div>

                      <h3 className="text-lg font-bold text-slate-900">
                        Key clauses
                      </h3>

                      <p className="text-xs text-slate-400 mt-1">
                        Important terms identified in the document
                      </p>

                    </div>


                    <span className="text-xs font-semibold text-slate-400">

                      {(sel.clauses ||
                        []).length}

                      {" "}
                      found

                    </span>

                  </div>


                  {(sel.clauses ||
                    []).length ===
                  0 ? (

                    <div className="border border-dashed border-slate-200 rounded-2xl p-7 text-center text-sm text-slate-400">

                      No key clauses were identified.

                    </div>

                  ) : (

                    <div className="space-y-3">

                      {(sel.clauses ||
                        []).map(
                          (
                            clause,
                            index
                          ) => {

                            const title =
                              clause.title ||
                              clause.clauseType ||
                              clause.name ||
                              "Key Clause";


                            const explanation =
                              clause.explanation ||
                              clause.simpleExplanation ||
                              clause.description ||
                              clause.text ||
                              "No explanation available.";


                            const risk =
                              clause.risk ||
                              clause.riskLevel ||
                              clause.severity ||
                              "Medium";


                            const page =
                              clause.pageNumber ??
                              clause.page ??
                              clause.pageNo ??
                              null;


                            return (

                              <div
                                className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition"
                                key={
                                  index
                                }
                              >

                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">

                                  <div className="flex gap-3">

                                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">

                                      <FileCheck2
                                        size={16}
                                      />

                                    </div>


                                    <div>

                                      <h4 className="font-bold text-sm text-slate-900">
                                        {title}
                                      </h4>


                                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">

                                        <FileText
                                          size={12}
                                        />

                                        Page{" "}
                                        {page ||
                                          "Not available"}

                                      </div>

                                    </div>

                                  </div>


                                  <span
                                    className={`self-start px-2.5 py-1 rounded-full text-[11px] font-bold ${riskClass(
                                      risk
                                    )}`}
                                  >
                                    {risk}
                                  </span>

                                </div>


                                <div className="mt-4 ml-0 sm:ml-12">

                                  <p className="text-sm text-slate-600 leading-6">
                                    {explanation}
                                  </p>

                                </div>

                              </div>

                            );

                          }
                        )}

                    </div>

                  )}

                </div>


                {/* =================================================
                    POTENTIAL RISKS
                ================================================= */}

                <div className="mt-8">

                  <div className="mb-4">

                    <h3 className="text-lg font-bold text-slate-900">
                      Potential risks
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
                      Terms that may deserve additional attention
                    </p>

                  </div>


                  {(sel.risks ||
                    []).length ===
                  0 ? (

                    <div className="border border-dashed border-slate-200 rounded-2xl p-7 text-center text-sm text-slate-400">

                      No significant potential risks were identified.

                    </div>

                  ) : (

                    <div className="space-y-3">

                      {(sel.risks ||
                        []).map(
                          (
                            risk,
                            index
                          ) => {

                            const title =
                              typeof risk ===
                              "string"
                                ? "Potential Risk"
                                : risk.title ||
                                  risk.name ||
                                  "Potential Risk";


                            const description =
                              typeof risk ===
                              "string"
                                ? risk
                                : risk.description ||
                                  risk.explanation ||
                                  "";


                            const severity =
                              typeof risk ===
                              "string"
                                ? "Medium"
                                : risk.severity ||
                                  risk.risk ||
                                  "Medium";


                            const page =
                              typeof risk ===
                              "string"
                                ? null
                                : risk.pageNumber ||
                                  risk.page ||
                                  risk.pageNo ||
                                  null;


                            return (

                              <div
                                key={
                                  index
                                }
                                className={`rounded-2xl border p-5 ${
                                  severity ===
                                  "High"
                                    ? "border-red-100 bg-red-50/40"
                                    : severity ===
                                      "Medium"
                                    ? "border-amber-100 bg-amber-50/40"
                                    : "border-emerald-100 bg-emerald-50/40"
                                }`}
                              >

                                <div className="flex gap-3">

                                  <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                      severity ===
                                      "High"
                                        ? "bg-red-100 text-red-600"
                                        : severity ===
                                          "Medium"
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-emerald-100 text-emerald-600"
                                    }`}
                                  >

                                    <AlertTriangle
                                      size={17}
                                    />

                                  </div>


                                  <div className="flex-1 min-w-0">

                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">

                                      <div>

                                        <h4 className="font-bold text-sm text-slate-900">
                                          {title}
                                        </h4>


                                        {page && (

                                          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">

                                            <FileText
                                              size={11}
                                            />

                                            Page{" "}
                                            {page}

                                          </p>

                                        )}

                                      </div>


                                      <span
                                        className={`self-start px-2.5 py-1 rounded-full text-[11px] font-bold ${riskClass(
                                          severity
                                        )}`}
                                      >
                                        {severity}
                                      </span>

                                    </div>


                                    <p className="text-sm text-slate-600 leading-6 mt-3">
                                      {description}
                                    </p>

                                  </div>

                                </div>

                              </div>

                            );

                          }
                        )}

                    </div>

                  )}

                </div>


                {/* =================================================
                    PAGE-AWARE CHATBOT
                ================================================= */}

                <div className="mt-8 rounded-3xl bg-slate-950 p-5 sm:p-6 text-white">

                  <div className="flex items-start gap-3 mb-5">

                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">

                      <MessageCircle
                        size={19}
                      />

                    </div>


                    <div>

                      <h3 className="font-bold">
                        Ask LegalEase
                      </h3>

                      <p className="text-xs text-slate-400 mt-1">
                        Ask questions about this document.
                        Answers can include source pages.
                      </p>

                    </div>

                  </div>


                  {/* QUICK QUESTIONS */}

                  <div className="flex flex-wrap gap-2 mb-4">

                    {[
                      "What is the termination notice period?",
                      "What are the main risks?",
                      "What does this agreement require from me?"
                    ].map(
                      question => (

                        <button
                          key={
                            question
                          }
                          type="button"
                          onClick={() =>
                            setQ(
                              question
                            )
                          }
                          className="text-[11px] px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-slate-300 hover:bg-white/15 transition"
                        >
                          {question}
                        </button>

                      )
                    )}

                  </div>


                  {/* INPUT */}

                  <div className="flex flex-col sm:flex-row gap-2">

                    <input
                      className="flex-1 bg-white/10 border border-white/10 text-white placeholder:text-slate-500 rounded-xl px-4 py-3.5 focus:bg-white/15 focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="e.g. What is the termination notice period?"
                      value={
                        q
                      }
                      onChange={
                        e =>
                          setQ(
                            e.target.value
                          )
                      }
                      onKeyDown={
                        e => {

                          if (
                            e.key ===
                            "Enter" &&
                            !e.shiftKey
                          ) {

                            e.preventDefault();

                            ask();

                          }

                        }
                      }
                    />


                    <button
                      type="button"
                      className="bg-indigo-500 text-white rounded-xl px-6 py-3.5 font-semibold hover:bg-indigo-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      onClick={
                        ask
                      }
                      disabled={
                        loading ||
                        !q.trim()
                      }
                    >

                      {loading ? (

                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />

                          Thinking...

                        </>

                      ) : (

                        <>
                          Ask

                          <Sparkles
                            size={15}
                          />

                        </>

                      )}

                    </button>

                  </div>


                  {/* ANSWER */}

                  {ans && (

                    <div className="mt-4 bg-white/10 border border-white/10 rounded-2xl p-5">

                      <div className="flex items-center gap-2 text-indigo-300">

                        <ShieldCheck
                          size={17}
                        />

                        <span className="font-semibold text-sm">
                          LegalEase answer
                        </span>

                      </div>


                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200 leading-7">
                        {ans}
                      </p>


                      {/* SOURCES */}

                      {chatSources.length >
                        0 && (

                        <div className="mt-5 pt-4 border-t border-white/10">

                          <div className="flex items-center gap-2 text-indigo-300">

                            <FileText
                              size={15}
                            />

                            <span className="text-xs font-semibold">
                              Sources from your document
                            </span>

                          </div>


                          <div className="flex flex-wrap gap-2 mt-3">

                            {chatSources.map(
                              (
                                source,
                                index
                              ) => (

                                <div
                                  key={
                                    index
                                  }
                                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-3 py-2"
                                >

                                  <span className="text-xs text-slate-200">
                                    {source.title ||
                                      "Document source"}
                                  </span>


                                  {source.pageNumber && (

                                    <span className="text-[11px] font-semibold text-indigo-300">
                                      Page{" "}
                                      {
                                        source.pageNumber
                                      }
                                    </span>

                                  )}

                                </div>

                              )
                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  )}

                </div>


                {/* =================================================
                    DISCLAIMER
                ================================================= */}

                <div className="mt-6 flex gap-2 items-start rounded-xl bg-amber-50 border border-amber-100 p-4">

                  <Info
                    size={15}
                    className="text-amber-600 mt-0.5 shrink-0"
                  />

                  <p className="text-xs text-amber-800 leading-5">

                    LegalEase provides informational assistance
                    for legal literacy. AI-generated results may
                    be incomplete or inaccurate and should not
                    be treated as professional legal advice.

                  </p>

                </div>


              </div>

            )}

          </section>

        </div>

      </main>

    </div>

  );

}


// Render

createRoot(
  document.getElementById(
    "root"
  )
).render(

  <BrowserRouter>

    <App />

  </BrowserRouter>

);
