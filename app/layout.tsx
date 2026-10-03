import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "next-themes";
import CoursePreloader from "@/components/CoursePreloader";
import NetworkStatusNotice from "@/components/NetworkStatusNotice";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Course Craft",
  description: "A structured study workspace for FUTO Level 200 cybersecurity students. Turn course documents into chapter notes, quizzes, and guided review.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} font-sans antialiased`}>
        <CoursePreloader />
        <NetworkStatusNotice />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <footer className="mt-auto border-t border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-[#0b1220]">
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-10">
                <span className="font-medium text-slate-600 dark:text-slate-400"><span className="text-blue-700 dark:text-blue-400">CYB</span> 200lvl</span>
                <p>
                  Built by <span className="font-semibold text-slate-700 dark:text-slate-200">Zitechurity IT Solutions</span>
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
