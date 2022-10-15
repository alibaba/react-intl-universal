import type { AppProps } from 'next/app'
import '../styles/vars.scss'
import '../styles/global.scss'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="root">
      <Component {...pageProps} />
    </div>
  );
}

export default MyApp
