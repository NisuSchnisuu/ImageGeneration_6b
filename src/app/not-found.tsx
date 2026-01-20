import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <h2 className="text-3xl font-bold text-yellow-500 mb-4">Nicht gefunden</h2>
            <p className="text-gray-400 mb-8">Diese Seite existiert nicht.</p>
            <Link href="/" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors">
                Zurück zur Startseite
            </Link>
        </div>
    )
}
