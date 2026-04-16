import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';


export const metadata = {
  title: 'Cookie Policy | Roger Wilco Aviation Services',
  description: 'Cookie policy for Roger Wilco Aviation Services (rogerwilcoaviation.com). How we use cookies and tracking.',
  alternates: { canonical: 'https://rogerwilcoaviation.com/cookies' },
};
export default function Cookies() {
  return (
    <div className="flex flex-col w-full min-h-screen items-center justify-between fancy-overlay">
      <Header />

      <div className="w-full flex flex-col items-center my-12">
        <section className="w-full p-6 container-narrow">
          <h1 className="text-4xl font-semibold leading-tight md:leading-tight max-w-xs sm:max-w-none md:text-6xl fancy-heading">
            Cookie Policy
          </h1>

          <p className="mt-6 md:text-xl">
            At Mevolut, we use cookies to enhance your experience, personalize
            content, and analyze website traffic. Cookies help us understand how
            visitors interact with our platform, enabling us to improve our
            services and ensure a safer, more efficient experience for you.
          </p>

          <p className="mt-6 md:text-xl">
            By using our website, you consent to our use of cookies in
            accordance with this policy. You can manage your cookie preferences
            through your browser settings at any time. Please note that
            disabling cookies may affect some functionalities of our platform,
            and certain features might not work as intended.
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
