/**
 * Footer — Reusable site-wide footer with author credit.
 */

export default function Footer() {
    return (
        <footer className="w-full py-4 px-4 text-center border-t border-gray-200/50 bg-white/60 backdrop-blur-sm">
            <p className="text-xs text-zayko-500 font-semibold mb-1">⚡ Powered by Zayko</p>
            <p className="text-xs text-gray-400 leading-relaxed">
                Made with <span className="text-red-400">❤️</span> by{" "}
                <span className="font-semibold text-gray-500">Shudhanshu Pandey</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
                MCA 2nd Sem &nbsp;|&nbsp; Roll No: 25mca045
            </p>
        </footer>
    );
}
