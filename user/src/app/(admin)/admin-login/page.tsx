"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) { setError("Enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.detail || "Invalid email or password.");
        return;
      }
      const role = data?.user?.role;
      if (role !== "admin" && role !== "super_admin") {
        setError("This account doesn't have admin access.");
        return;
      }
      // Store tokens so admin API calls (apiFetch) are authenticated.
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/admin-users");
    } catch {
      setError("The server is waking up. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: "100%", height: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden"
    }}>
      <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"#22c55e",opacity:.05,top:-100,right:-80}} />
      <div style={{position:"absolute",width:250,height:250,borderRadius:"50%",background:"#16a34a",opacity:.05,bottom:-60,left:-40}} />

      <div style={{background:"#fff",borderRadius:14,padding:"36px 32px",width:320,position:"relative",zIndex:2}}>
        <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center",marginBottom:6}}>
          <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{height:40,width:"auto"}} />
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#9ca3af",marginBottom:24,fontWeight:500,letterSpacing:"0.5px",textTransform:"uppercase"}}>Administration Portal</p>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:4,fontWeight:500}}>Email</label>
          <input type="email" placeholder="hello@finquanta.com" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
            style={{width:"100%",padding:"8px 12px",border:"0.5px solid #e5e7eb",borderRadius:7,fontSize:13,outline:"none",background:"#f9fafb",color:"#0f172a"}} />
        </div>

        <div style={{marginBottom:8}}>
          <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:4,fontWeight:500}}>Password</label>
          <div style={{position:"relative"}}>
            <input type={showPass ? "text" : "password"} placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              style={{width:"100%",padding:"8px 12px",border:"0.5px solid #e5e7eb",borderRadius:7,fontSize:13,outline:"none",background:"#f9fafb",color:"#0f172a"}} />
            <span onClick={() => setShowPass(!showPass)}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:12,color:"#9ca3af"}}>
              {showPass ? "Hide" : "Show"}
            </span>
          </div>
        </div>

        {error && <p style={{color:"#dc2626",fontSize:12,marginTop:10,marginBottom:0}}>{error}</p>}

        <button onClick={handleLogin} disabled={loading} style={{
          width:"100%",background: loading ? "#86efac" : "#22c55e",color:"#fff",border:"none",borderRadius:7,
          padding:10,fontSize:13,fontWeight:700,cursor: loading ? "default" : "pointer",marginTop:12,letterSpacing:"0.5px"
        }}>{loading ? "SIGNING IN…" : "LOGIN"}</button>
        <p style={{textAlign:"center",marginTop:12,fontSize:12,color:"#9ca3af"}}>
          Forgot password? <span onClick={() => router.push("/admin-forgot-password")} style={{color:"#16a34a",fontWeight:500,cursor:"pointer"}}>Reset here</span>
        </p>
      </div>
      <span style={{position:"absolute",bottom:12,fontSize:11,color:"rgba(255,255,255,.25)"}}>Finquanta Ltd. © 2024 · Administration Portal</span>
    </div>
  );
}
