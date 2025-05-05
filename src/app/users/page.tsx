
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UsersComponentClient from '@/components/UsersComponentClient';

export default function Users() {
  return (
    <>
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-4xl">
            <UsersComponentClient />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
