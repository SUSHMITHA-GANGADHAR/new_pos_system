import os

class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lqgdvacncugzlydvvijz.supabase.co").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2R2YWNuY3Vnemx5ZHZ2aWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI0MDczOSwiZXhwIjoyMDg5ODE2NzM5fQ.0uYkrWU0Ukzf9fBv_73y8sLOUWwX5hxig0KEJF9tBF8").strip()
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2R2YWNuY3Vnemx5ZHZ2aWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDA3MzksImV4cCI6MjA4OTgxNjczOX0.p0j3a9XvJW3FJDNyAy9Xn_jPPEbpIbFKyYshjZUTofg").strip()
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "b7f3e9a1c4d8f2e6a9b3c5d7e1f4a8c2d6b9e3f7a1c5d8e2f4b6a9c3d7e1f2a4")
    DEBUG = False
