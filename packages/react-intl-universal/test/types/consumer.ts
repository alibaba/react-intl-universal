import React from "react";
import intl, {
  type ReactIntlUniversalRichMessageResult,
  type ReactIntlUniversalRichTagFormatter,
  ReactIntlUniversal,
  changeCurrentLocale,
  determineLocale,
  formatHTMLMessage,
  formatList,
  formatMessage,
  formatNumber,
  formatParentheses,
  get,
  getColon,
  getHTML,
  getInitOptions,
  init,
  load,
} from "../../lib";

intl.get("SIMPLE").defaultMessage("Simple");
intl.get("SIMPLE").d("Simple");

const fallbackElement = React.createElement("span", null, "Fallback");
const htmlFallback: string | React.ReactElement = intl.getHTML("TIP").defaultMessage(fallbackElement);
const namedHtmlFallback: string | React.ReactElement = getHTML("TIP").d(fallbackElement);

const instance = new ReactIntlUniversal();
instance.init({ currentLocale: "en-US", locales: { "en-US": {} } });

get("SIMPLE").d("Simple");
formatMessage({ id: "SIMPLE", defaultMessage: "Simple" });
formatHTMLMessage({ id: "TIP", defaultMessage: fallbackElement });
init({ currentLocale: "en-US", locales: { "en-US": {} } });
load({ "en-US": { SIMPLE: "Simple" } });
changeCurrentLocale("zh-CN");
determineLocale({ urlLocaleKey: "lang" });
getInitOptions();
formatList(["a", fallbackElement], { style: "narrow" });
formatParentheses(fallbackElement);
getColon();

const formattedNumber: string | number = formatNumber(1234);
const originalString: string = formatNumber("not a number");

const primitiveGetResult: string = intl.get("HELLO", { name: "Tony" });
const primitiveNamedGetResult: string = get("HELLO", { name: "Tony" }).d("Hello, {name}");

const richFormatter: ReactIntlUniversalRichTagFormatter = (chunks) => React.createElement("strong", null, chunks);
const richGetResult: ReactIntlUniversalRichMessageResult = intl.get("RICH", {
  label: "docs",
  tag: richFormatter,
});
const inlineRichGetResult: ReactIntlUniversalRichMessageResult = intl.get("RICH_INLINE", {
  label: "docs",
  tag: (chunks) => React.createElement("strong", null, chunks),
});
const richDefaultResult: ReactIntlUniversalRichMessageResult = intl.get("MISSING_RICH", {
  tag: richFormatter,
}).defaultMessage("Fallback <tag>docs</tag>");
const richDResult: ReactIntlUniversalRichMessageResult = get("MISSING_RICH", {
  tag: richFormatter,
}).d("Fallback <tag>docs</tag>");
const richFormatMessageResult: ReactIntlUniversalRichMessageResult = formatMessage(
  { id: "RICH", defaultMessage: "Open <tag>{label}</tag>" },
  {
    label: "docs",
    tag: richFormatter,
  }
);
const renderableRichResult: React.ReactNode = richGetResult;

const unsupportedNodePlaceholderResult: string = intl.get("ICON_PLACEHOLDER", {
  icon: React.createElement("span", null, "icon"),
});

"".defaultMessage("fallback");
"".d(fallbackElement);

void htmlFallback;
void namedHtmlFallback;
void formattedNumber;
void originalString;
void primitiveGetResult;
void primitiveNamedGetResult;
void inlineRichGetResult;
void richDefaultResult;
void richDResult;
void richFormatMessageResult;
void renderableRichResult;
void unsupportedNodePlaceholderResult;
