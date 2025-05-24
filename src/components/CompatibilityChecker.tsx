import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const CompatibilityChecker: React.FC = () => {
    const [url, setUrl] = useState('');
    const [result, setResult] = useState<{
        compatible: boolean;
        frameworks?: string[];
        error?: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const validateUrl = (url: string): boolean => {
        const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        return urlPattern.test(url);
    };

    const handleCheck = async () => {
        setLoading(true);
        setResult(null);
        setApiError(null);

        // Basic URL validation
        if (!url.trim()) {
            setApiError('Please enter a URL');
            setLoading(false);
            return;
        }

        if (!validateUrl(url)) {
            setApiError('Please enter a valid URL');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5001/api/check-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setResult(data);
        } catch (error) {
            let errorMessage = 'Failed to check site compatibility.';
            if (error instanceof Error) {
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    errorMessage = 'Could not connect to the server. Please make sure the API server is running.';
                } else {
                    errorMessage = `Error: ${error.message}`;
                }
            }
            setApiError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCheck();
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="flex flex-col items-center space-y-6">
                <div className="w-full max-w-xl flex space-x-4">
                    <Input
                        type="text"
                        placeholder="Enter your website URL (e.g., example.com)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="flex-1"
                        disabled={loading}
                    />
                    <Button
                        onClick={handleCheck}
                        disabled={!url || loading}
                        className="min-w-[140px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            'Check Compatibility'
                        )}
                    </Button>
                </div>

                {apiError && (
                    <div className="w-full max-w-xl bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                        <div className="flex items-center text-red-500">
                            <AlertCircle className="h-5 w-5 mr-2" />
                            <p>{apiError}</p>
                        </div>
                    </div>
                )}

                {result && !apiError && (
                    <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                        {result.compatible ? (
                            <>
                                <div className="flex items-center mb-4">
                                    <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                                    <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
                                        Yes! Your site is compatible.
                                    </h3>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300">
                                    Your site was built with{' '}
                                    <span className="font-semibold">
                                        {result.frameworks?.join(', ')}.
                                    </span>
                                </p>
                            </>
                        ) : (
                            <div className="flex items-center text-red-600 dark:text-red-400">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                <p>{result.error || 'Unable to check site compatibility'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompatibilityChecker; 