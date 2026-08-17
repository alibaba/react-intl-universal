import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/vars.scss'
import '../styles/global.scss'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="root">
      <Head>
        <link rel="icon" href="https://github.githubassets.com/favicons/favicon.svg" type="image/svg+xml" />
      </Head>
      <Component {...pageProps} />
    </div>
  );
}

export default MyApp
