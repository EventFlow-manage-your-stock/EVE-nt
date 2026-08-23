'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  email: string;
  imie: string;
  nazwisko: string;
  organizacja: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wykonuje się tylko w przeglądarce (po wyrenderowaniu strony)
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        // Przywracamy sesję z dysku do pamięci
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Błąd parsowania danych użytkownika', error);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
      }
    } else {
      // Jeśli nie ma tokenu, a użytkownik próbuje wejść na /dashboard, wyrzucamy do logowania
      if (pathname.startsWith('/dashboard')) {
        router.push('/login'); // lub na stronę główną '/'
      }
    }
    
    // Zdejmujemy flagę ładowania, aplikacja wie już, kim jesteśmy
    setIsLoading(false);
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {/* Nie renderujemy dzieci, dopóki nie sprawdzimy kim jest użytkownik */}
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

// Custom hook dla wygody
export const useAuth = () => useContext(AuthContext);