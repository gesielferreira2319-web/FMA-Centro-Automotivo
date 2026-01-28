
import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, Download } from 'lucide-react';

export default function Install() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        // iOS detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));

        // Capture install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        }
    };

    if (isStandalone) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                    <img src="/pwa-192x192.png" alt="FMA Logo" className="w-24 h-24 rounded-2xl mx-auto mb-4 shadow-lg" />
                    <h1 className="text-xl font-bold text-gray-800">FMA Centro Automotivo</h1>
                    <p className="text-green-600 mt-2 font-medium">Aplicativo já instalado!</p>
                    <a href="/" className="mt-6 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                        Abrir Sistema
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-center text-white">
                    <img
                        src="/pwa-512x512.png"
                        alt="FMA Logo"
                        className="w-32 h-32 rounded-3xl mx-auto mb-6 shadow-2xl border-4 border-white/10"
                    />
                    <h1 className="text-2xl font-bold mb-2">FMA Centro Automotivo</h1>
                    <p className="text-gray-300 mb-4">(21) 99999-9999</p>
                    <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-sm backdrop-blur-sm">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Versão 1.0
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {isIOS ? (
                        // iOS Instructions
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-gray-600 font-medium">Para instalar no iPhone/iPad:</p>
                            </div>

                            <ol className="space-y-4">
                                <li className="flex items-start gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                        <Share size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600">1. Toque no botão</p>
                                        <p className="font-bold text-gray-800">Compartilhar</p>
                                        <p className="text-xs text-gray-500 mt-1">Geralmente na barra inferior</p>
                                    </div>
                                </li>

                                <li className="flex items-start gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                        <PlusSquare size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600">2. Selecione</p>
                                        <p className="font-bold text-gray-800">Adicionar à Tela de Início</p>
                                        <p className="text-xs text-gray-500 mt-1">Role para baixo se necessário</p>
                                    </div>
                                </li>
                            </ol>
                        </div>
                    ) : (
                        // Android / Desktop Install Button
                        <div className="text-center">
                            <p className="text-gray-600 mb-6">
                                Instale o aplicativo para acesso rápido e melhor experiência.
                            </p>

                            <button
                                onClick={handleInstallClick}
                                disabled={!deferredPrompt}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Download size={24} />
                                {deferredPrompt ? 'Instalar Agora' : 'Instalação indisponível'}
                            </button>

                            {!deferredPrompt && (
                                <p className="text-xs text-gray-400 mt-4">
                                    Se o botão estiver desativado, tente abrir no Google Chrome ou o app já está instalado.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">© 2026 FMA Centro Automotivo</p>
                </div>
            </div>
        </div>
    );
}
