import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "../store/authStore";
import apiClient from "../api/client";
import Button from "../components/Button";
import {
  Siren,
  ClipboardList,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // ستيت لتحديد الزرار النشط وتنويره (Citizen افتراضي)
  const [activeRole, setActiveRole] = useState<"citizen" | "authority" | "admin">("citizen");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    try {
      const response = await apiClient.post("/api/account/login", data);
      const token =
        response.data.accessToken ||
        response.data.user?.token ||
        response.data.token;
      
      login(token);

      // التوجيه المباشر والذكي بناءً على الـ activeRole المحدد في الـ UI
      if (activeRole === "citizen") {
        navigate("/citizen/feed");
      } else if (activeRole === "authority") {
        navigate("/authority/dashboard");
      } else if (activeRole === "admin") {
        navigate("/admin/dashboard");
      }
      
    } catch (err: any) {
      setLoading(false);
      setError("root", { message: "Invalid email or password" });
    }
  };

  const handleDemoFill = (
    role: "citizen" | "authority" | "admin",
  ) => {
    setActiveRole(role); // تنوير الزرار اللي تم ضغطه فوراً
    const demoAccounts = {
      citizen: { email: "citizen@ain.com", password: "password123" },
      authority: { email: "authority@ain.com", password: "password123" },
      admin: { email: "admin@ain.com", password: "password123" },
    };
    setValue("email", demoAccounts[role].email);
    setValue("password", demoAccounts[role].password);
  };

  return (
    <div className="min-h-screen flex bg-gray-900 font-sans">
      {/* ─── Left Side: Branding & Features (Hidden on mobile) ─── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-800 to-slate-950 flex-col items-center justify-center p-12 border-r border-gray-800">
        <div className="max-w-md w-full space-y-12">
          {/* Logo Section */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-blue-900/50">
              A
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-wider">
                AIN
              </h1>
              <p className="text-gray-400 text-sm mt-1 font-medium font-arabic">
                عين
              </p>
            </div>
            <p className="text-gray-400 text-center max-w-sm">
              Civic reporting & community safety platform for a safer tomorrow
            </p>
          </div>

          {/* Features Section */}
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors">
              <div className="bg-red-500/20 p-3 rounded-xl shrink-0">
                <Siren className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Emergency SOS</h3>
                <p className="text-sm text-gray-400">
                  Real-time location sharing with communities
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors">
              <div className="bg-amber-500/20 p-3 rounded-xl shrink-0">
                <ClipboardList className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Civic Reports</h3>
                <p className="text-sm text-gray-400">
                  Submit and track local issues transparently
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors">
              <div className="bg-blue-500/20 p-3 rounded-xl shrink-0">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Authority Response</h3>
                <p className="text-sm text-gray-400">
                  Direct channel to government authorities
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Side: Login Form ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Form Header */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400">Sign in to your account to continue</p>
          </div>

          {/* Demo Auto-fill Section */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-3">
            <p className="text-xs text-blue-400 font-medium">
              Demo — click to auto-fill:
            </p>
            <div className="flex flex-wrap gap-2">
              {(["citizen", "authority", "admin"] as const).map((role) => {
                const isActive = activeRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemoFill(role)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize outline-none border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  placeholder="ahmed@example.com"
                  {...register("email")}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-10 py-3 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-300">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-sm text-blue-500 hover:text-blue-400 font-medium"
              >
                Forgot password?
              </a>
            </div>

            {errors.root && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg text-center">
                {errors.root.message}
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              className="w-full py-3 text-base"
            >
              Sign in →
            </Button>
          </form>

          {/* Create Account Link */}
          <p className="text-center text-sm text-gray-400 pt-4">
            Don't have an account?{" "}
            {/* التعديل هنا: التوجيه لصفحة /signup */}
            <Link
              to="/signup"
              className="text-blue-500 hover:text-blue-400 font-medium"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}