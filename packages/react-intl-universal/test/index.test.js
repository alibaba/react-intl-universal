import React from "react";
import intl, { ReactIntlUniversal } from "../src/index";
import * as intlExports from "../src/index";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";
import enUSMore from "./locales/en-US-more";
import LocalStorageMock from "./util/LocalStorageMock";
global.localStorage = new LocalStorageMock;
const dataKey = 'data-i18n-key';

const locales = {
  "en-US": enUS,
  "zh-CN": zhCN,
};

describe("Public API behavior", () => {
  test("default export exposes public singleton methods", () => {
    const publicMethods = [
      "get",
      "getHTML",
      "formatMessage",
      "formatHTMLMessage",
      "determineLocale",
      "changeCurrentLocale",
      "init",
      "getInitOptions",
      "load",
      "getLocaleFromCookie",
      "getLocaleFromLocalStorage",
      "getLocaleFromURL",
      "getDescendantProp",
      "getLocaleFromBrowser",
      "formatList",
      "formatParentheses",
      "getColon",
      "formatNumber",
    ];

    publicMethods.forEach((method) => {
      expect(typeof intl[method]).toBe("function");
    });
    expect(intl.ReactIntlUniversal).toBe(ReactIntlUniversal);
  });

  test("named exports keep operating on the default singleton", () => {
    const namedExports = [
      "get",
      "getHTML",
      "formatMessage",
      "formatHTMLMessage",
      "determineLocale",
      "changeCurrentLocale",
      "init",
      "getInitOptions",
      "load",
      "getLocaleFromCookie",
      "getLocaleFromLocalStorage",
      "getLocaleFromURL",
      "getDescendantProp",
      "getLocaleFromBrowser",
      "formatList",
      "formatParentheses",
      "getColon",
      "formatNumber",
    ];

    namedExports.forEach((exportName) => {
      expect(typeof intlExports[exportName]).toBe("function");
    });
    expect(intlExports.default).toBe(intl);
    expect(intlExports.ReactIntlUniversal).toBe(ReactIntlUniversal);

    intlExports.init({ locales, currentLocale: "en-US" });
    expect(intlExports.get("SIMPLE")).toBe("Simple");
    intlExports.changeCurrentLocale("zh-CN");
    expect(intlExports.get("SIMPLE")).toBe("简单");
  });

  test("react-intl mirror APIs preserve defaultMessage and d fallback compatibility", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatMessage({ id: "not-exist-key" }).d("fallback text")).toBe("fallback text");

    const fallbackElement = React.createElement("span", { className: "fallback" }, "Fallback");
    const result = intl.formatHTMLMessage({ id: "not-exist-key" }).d(fallbackElement);
    expect(result).toBe(fallbackElement);
  });

  test("debug messages keep defaultMessage and d aliases", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });

    const message = innerIntl.get("SIMPLE");
    expect(message.defaultMessage("fallback").props[dataKey]).toBe("SIMPLE");
    expect(message.d("fallback").props[dataKey]).toBe("SIMPLE");
  });

  test("determineLocale prefers URL, then cookie, then localStorage, then browser", () => {
    localStorage.setItem("guardStorageLang", "ja-JP");
    document.cookie = "guardCookieLang=zh-CN";

    window.history.pushState({}, "", "?guardUrlLang=fr-FR");
    expect(intl.determineLocale({
      urlLocaleKey: "guardUrlLang",
      cookieLocaleKey: "guardCookieLang",
      localStorageLocaleKey: "guardStorageLang",
    })).toBe("fr-FR");

    window.history.pushState({}, "", "?other=1");
    expect(intl.determineLocale({
      urlLocaleKey: "guardUrlLang",
      cookieLocaleKey: "guardCookieLang",
      localStorageLocaleKey: "guardStorageLang",
    })).toBe("zh-CN");

    expect(intl.determineLocale({
      urlLocaleKey: "guardUrlLang",
      cookieLocaleKey: "missingGuardCookieLang",
      localStorageLocaleKey: "guardStorageLang",
    })).toBe("ja-JP");

    expect(intl.determineLocale({
      urlLocaleKey: "guardUrlLang",
      cookieLocaleKey: "missingGuardCookieLang",
      localStorageLocaleKey: "missingGuardStorageLang",
    })).toBe("en-US");
  });
});

describe("Exceptional path behavior", () => {
  test("intlGetHook receives key and locale, and hook errors do not break formatting", () => {
    const innerIntl = new ReactIntlUniversal();
    const intlGetHook = jest.fn(() => {
      throw new Error("hook failed");
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    innerIntl.init({ locales, currentLocale: "en-US", intlGetHook });
    expect(innerIntl.get("SIMPLE")).toBe("Simple");
    expect(intlGetHook).toHaveBeenCalledWith("SIMPLE", "en-US");
    expect(logSpy).toHaveBeenCalledWith("intl get hook error: ", expect.any(Error));

    logSpy.mockRestore();
  });

  test("formatting errors call warningHandler and return the raw message", () => {
    const innerIntl = new ReactIntlUniversal();
    const warningHandler = jest.fn();
    const brokenLocales = {
      "en-US": {
        BROKEN: "Hello, {name",
      },
    };

    innerIntl.init({ locales: brokenLocales, currentLocale: "en-US", warningHandler });

    expect(innerIntl.get("BROKEN", { name: "Tony" })).toBe("Hello, {name");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal format message failed for key='BROKEN'.",
      expect.any(String)
    );
  });

  test("changeCurrentLocale warns and keeps current locale when target locale is missing", () => {
    const innerIntl = new ReactIntlUniversal();
    const warningHandler = jest.fn();

    innerIntl.init({ locales, currentLocale: "en-US", warningHandler });
    innerIntl.changeCurrentLocale("fr-FR");

    expect(warningHandler).toHaveBeenCalledWith('react-intl-universal locales data "fr-FR" not exists.');
    expect(innerIntl.getInitOptions().currentLocale).toBe("en-US");
    expect(innerIntl.get("SIMPLE")).toBe("Simple");
  });

  test("get warns when currentLocale has no locale data", () => {
    const innerIntl = new ReactIntlUniversal();
    const warningHandler = jest.fn();

    innerIntl.init({ locales, currentLocale: "fr-FR", warningHandler });

    expect(innerIntl.get("SIMPLE")).toBe("");
    expect(warningHandler).toHaveBeenCalledWith('react-intl-universal locales data "fr-FR" not exists.');
  });

  test("init validates required currentLocale and locales options", () => {
    const innerIntl = new ReactIntlUniversal();

    expect(() => innerIntl.init()).toThrow("options.currentLocale is required");
    expect(() => innerIntl.init({ currentLocale: "en-US" })).toThrow("options.locales is required");
  });

  test("formatList returns an empty array for non-array input", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList("not an array")).toEqual([]);
  });

  test("getLocaleFromURL returns undefined when the URL has no query string", () => {
    window.history.pushState({}, "", "/no-query");
    expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBeUndefined();
  });

  test("getLocaleFromBrowser falls back to userLanguage", () => {
    const languageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "language");
    const userLanguageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "userLanguage");

    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, "userLanguage", {
      configurable: true,
      value: "en-GB",
    });

    expect(intl.getLocaleFromBrowser()).toBe("en-GB");

    if (languageDescriptor) {
      Object.defineProperty(window.navigator, "language", languageDescriptor);
    } else {
      delete window.navigator.language;
    }
    if (userLanguageDescriptor) {
      Object.defineProperty(window.navigator, "userLanguage", userLanguageDescriptor);
    } else {
      delete window.navigator.userLanguage;
    }
  });

  test("variable escaping handles String object values", () => {
    intl.init({ locales, currentLocale: "en-US" });
    const reactEl = intl.getHTML("TIP_VAR", {
      message: new String("<strong>wrapped</strong>"),
    });

    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is<span>&lt;strong&gt;wrapped&lt;/strong&gt;</span>"
    );
  });

  test("formatNumber returns original value when Intl.NumberFormat throws", () => {
    const numberFormatDescriptor = Object.getOwnPropertyDescriptor(Intl, "NumberFormat");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    Object.defineProperty(Intl, "NumberFormat", {
      configurable: true,
      value: function NumberFormat() {
        throw new Error("number format failed");
      },
    });

    try {
      intl.init({ locales, currentLocale: "en-US" });
      expect(intl.formatNumber(1234)).toBe(1234);
      expect(errorSpy).toHaveBeenCalledWith("Error formatting number:", expect.any(Error));
    } finally {
      Object.defineProperty(Intl, "NumberFormat", numberFormatDescriptor);
      errorSpy.mockRestore();
    }
  });
});

test("Set specific locale", () => {
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(intl.get("SIMPLE")).toBe("简单");
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("SIMPLE")).toBe("Simple");
});

test("Change specific locale", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("SIMPLE")).toBe("Simple");
  intl.changeCurrentLocale("zh-CN");
  expect(intl.get("SIMPLE")).toBe("简单");
});

test("Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("HELLO", { name: "Tony" })).toBe("Hello, Tony");
});

describe("Rich text interpolation", () => {
  let innerIntl;
  const richLocales = {
    "en-US": {
      RICH_RED_TAGS: "There are {number} <tag>Red Tags</tag>.",
      RICH_NESTED: "Open <link><strong>{label}</strong></link> now.",
      RICH_ONLY_TAG: "<tag>Red Tags</tag>",
      RICH_LINK: "Open <link>{label}</link>",
      RICH_MULTI_CHUNK: "Please read <link>{name} <strong>document</strong></link>.",
    },
  };

  beforeEach(() => {
    innerIntl = new ReactIntlUniversal();
    innerIntl.init({ locales: richLocales, currentLocale: "en-US" });
  });

  test("get formats locale messages with rich tag formatter functions", () => {
    const result = innerIntl.get("RICH_RED_TAGS", {
      number: 3,
      tag: chunks => React.createElement("strong", { className: "red" }, chunks),
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("There are 3 ");
    expect(result[1].type).toBe("strong");
    expect(result[1].props.className).toBe("red");
    expect(result[1].props.children).toEqual(["Red Tags"]);
    expect(result[2]).toBe(".");
  });

  test("get formats nested rich tags", () => {
    const result = innerIntl.get("RICH_NESTED", {
      label: "docs",
      link: chunks => React.createElement("a", { href: "/docs" }, chunks),
      strong: chunks => React.createElement("strong", null, chunks),
    });

    expect(result[0]).toBe("Open ");
    expect(result[1].type).toBe("a");
    expect(result[1].props.href).toBe("/docs");
    expect(result[1].props.children[0].type).toBe("strong");
    expect(result[1].props.children[0].props.children).toEqual(["docs"]);
    expect(result[2]).toBe(" now.");
  });

  test("rich formatter receives multiple chunks from tagged content", () => {
    const link = jest.fn(chunks => React.createElement("a", { href: "/docs" }, chunks));

    const result = innerIntl.get("RICH_MULTI_CHUNK", {
      name: "Tony",
      link,
      strong: chunks => React.createElement("strong", null, chunks),
    });

    expect(link).toHaveBeenCalledTimes(1);
    const chunks = link.mock.calls[0][0];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("Tony ");
    expect(chunks[1].type).toBe("strong");
    expect(chunks[1].props.children).toEqual(["document"]);
    expect(result[0]).toBe("Please read ");
    expect(result[1].type).toBe("a");
    expect(result[1].props.children).toBe(chunks);
    expect(result[2]).toBe(".");
  });

  test("single element rich output is normalized to a chunks array with helpers", () => {
    const result = innerIntl.get("RICH_ONLY_TAG", {
      tag: chunks => React.createElement("strong", null, chunks),
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("strong");
    expect(result[0].props.children).toEqual(["Red Tags"]);
    expect(typeof result.defaultMessage).toBe("function");
    expect(typeof result.d).toBe("function");
    expect(Object.keys(result)).not.toContain("defaultMessage");
    expect(Object.keys(result)).not.toContain("d");
    expect(result.d("Fallback")).toBe(result);
  });

  test("missing-key fallback messages use the same rich formatting path", () => {
    const result = innerIntl.get("MISSING_RICH", {
      number: 3,
      tag: chunks => React.createElement("strong", { className: "red" }, chunks),
    }).d("There are {number} <tag>Red Tags</tag>.");

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("There are 3 ");
    expect(result[1].type).toBe("strong");
    expect(result[1].props.className).toBe("red");
    expect(result[1].props.children).toEqual(["Red Tags"]);
    expect(result[2]).toBe(".");
  });

  test("formatMessage follows rich locale message behavior", () => {
    const result = innerIntl.formatMessage(
      { id: "RICH_LINK", defaultMessage: "Fallback <link>{label}</link>" },
      {
        label: "docs",
        link: chunks => React.createElement("a", { href: "/docs" }, chunks),
      }
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("Open ");
    expect(result[1].type).toBe("a");
    expect(result[1].props.href).toBe("/docs");
    expect(result[1].props.children).toEqual(["docs"]);
  });

  test("formatMessage formats descriptor defaultMessage through rich fallback", () => {
    const result = innerIntl.formatMessage(
      { id: "MISSING_RICH", defaultMessage: "Fallback <link>{label}</link>" },
      {
        label: "docs",
        link: chunks => React.createElement("a", { href: "/docs" }, chunks),
      }
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("Fallback ");
    expect(result[1].type).toBe("a");
    expect(result[1].props.href).toBe("/docs");
    expect(result[1].props.children).toEqual(["docs"]);
  });

  test("rich string variables are passed as React text without HTML pre-escaping", () => {
    const result = innerIntl.get("RICH_LINK", {
      label: "<b>docs</b>",
      link: chunks => React.createElement("a", { href: "/docs" }, chunks),
    });

    expect(result[1].type).toBe("a");
    expect(result[1].props.children).toEqual(["<b>docs</b>"]);
    expect(result[1].props.dangerouslySetInnerHTML).toBeUndefined();
  });
});

describe("String and legacy compatibility", () => {
  test("plain get calls still return strings and legacy HTML-like text stays literal", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          HELLO: "Hello, {name}",
          LEGACY_HTML: "This is <span>{message}</span>",
        },
      },
    });

    const plain = innerIntl.get("HELLO", { name: "Tony" });
    const legacyHtml = innerIntl.get("LEGACY_HTML", { message: "your message" });

    expect(typeof plain).toBe("string");
    expect(plain).toBe("Hello, Tony");
    expect(typeof legacyHtml).toBe("string");
    expect(legacyHtml).toBe("This is <span>your message</span>");
  });

  test("getHTML keeps legacy span wrapper and debug data key behavior", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      debug: true,
      locales: {
        "en-US": {
          LEGACY_HTML: "This is <span>{message}</span>",
        },
      },
    });

    const result = innerIntl.getHTML("LEGACY_HTML", { message: "your message" });

    expect(result.type).toBe("span");
    expect(result.props[dataKey]).toBe("LEGACY_HTML");
    expect(result.props.dangerouslySetInnerHTML.__html).toBe("This is <span>your message</span>");
  });

  test("plain missing-key fallback messages format ICU placeholders", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({ currentLocale: "en-US", locales: { "en-US": {} } });

    expect(innerIntl.get("MISSING_BOOKS", { num: 3 }).d("There are {num} books")).toBe(
      "There are 3 books"
    );
    expect(innerIntl.get("MISSING_GREETING", { username: "Tony" }).d("Hello, {username}!")).toBe(
      "Hello, Tony!"
    );
    const num = 3;
    expect(innerIntl.get("MISSING_TEMPLATE", { num }).d(`There are ${num} books`)).toBe(
      "There are 3 books"
    );
    expect(innerIntl.get("MISSING_TEMPLATE_ICU", { username: "Tony" }).d(`Hello, {username}!`)).toBe(
      "Hello, Tony!"
    );
  });

  test("fallback formatting failures warn and return the original fallback string", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: { "en-US": {} },
      warningHandler,
    });

    expect(innerIntl.get("MISSING_BROKEN", { name: "Tony" }).d("Broken {name")).toBe(
      "Broken {name"
    );
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal format default message failed for key='MISSING_BROKEN'.",
      expect.any(String)
    );
  });

  test("literal fallback syntax without variables returns the original fallback string", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: { "en-US": {} },
      warningHandler,
    });

    expect(
      innerIntl
        .get("MISSING_LITERAL_SCHEDULER_SYNTAX")
        .d("Use ${bizdate} and tableName_{yyyymmdd} as scheduler placeholders")
    ).toBe("Use ${bizdate} and tableName_{yyyymmdd} as scheduler placeholders");
    expect(warningHandler.mock.calls).not.toContainEqual([
      "react-intl-universal format default message failed for key='MISSING_LITERAL_SCHEDULER_SYNTAX'.",
      expect.any(String),
    ]);
  });

  test("literal fallback syntax with unrelated variables warns and returns the original fallback string", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: { "en-US": {} },
      warningHandler,
    });

    expect(
      innerIntl
        .get("MISSING_LITERAL_SCHEDULER_SYNTAX_WITH_VALUES", { name: "Tony" })
        .d("Use ${bizdate} and tableName_{yyyymmdd} as scheduler placeholders")
    ).toBe("Use ${bizdate} and tableName_{yyyymmdd} as scheduler placeholders");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal format default message failed for key='MISSING_LITERAL_SCHEDULER_SYNTAX_WITH_VALUES'.",
      expect.any(String)
    );
  });

  test("fallback locale remains authoritative over default messages", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "zh-CN",
      fallbackLocale: "en-US",
      locales: {
        "zh-CN": {},
        "en-US": {
          BOOKS: "There are {num} books",
        },
      },
    });

    expect(innerIntl.get("BOOKS", { num: 3 }).d("Fallback {num}")).toBe("There are 3 books");
  });

  test("locale formatting failures do not switch to default messages", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          BROKEN: "Broken {name",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("BROKEN", { name: "Tony" }).d("Fallback {name}")).toBe("Broken {name");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal format message failed for key='BROKEN'.",
      expect.any(String)
    );
  });

  test("function values without matching rich tags stay on the legacy string path", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          NO_TAG: "Hello, {name}",
          SELF_CLOSING: "Open <link/>",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("NO_TAG", {
      name: "Tony",
      unused: chunks => React.createElement("strong", null, chunks),
    })).toBe("Hello, Tony");
    expect(warningHandler).not.toHaveBeenCalled();

    expect(innerIntl.get("SELF_CLOSING", {
      link: chunks => React.createElement("a", null, chunks),
    })).toBe("Open <link/>");
    expect(warningHandler).not.toHaveBeenCalled();
  });

  test("unmatched, mixed, and unsupported rich tags fall back to legacy strings", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          CASE_MISMATCH: "Open <Tag>docs</Tag>",
          MIXED_TAGS: "Open <link>docs</link> <span>now</span>",
          ATTRIBUTE_TAG: "Open <link href=\"/docs\">docs</link>",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("CASE_MISMATCH", {
      tag: chunks => React.createElement("a", null, chunks),
    })).toBe("Open <Tag>docs</Tag>");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal rich text message contains unmatched tag(s) for key='CASE_MISMATCH'.",
      "Tag"
    );

    warningHandler.mockClear();
    expect(innerIntl.get("MIXED_TAGS", {
      link: chunks => React.createElement("a", null, chunks),
    })).toBe("Open <link>docs</link> <span>now</span>");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal rich text message contains unmatched tag(s) for key='MIXED_TAGS'.",
      "span"
    );

    warningHandler.mockClear();
    expect(innerIntl.get("ATTRIBUTE_TAG", {
      link: chunks => React.createElement("a", null, chunks),
    })).toBe("Open <link href=\"/docs\">docs</link>");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal rich format message failed for key='ATTRIBUTE_TAG'.",
      expect.any(String)
    );
  });
});

describe("Rich debug and failure paths", () => {
  test("debug mode wraps rich output inside a chunks array and keeps helpers on the array", () => {
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      debug: true,
      locales: {
        "en-US": {
          RICH_LINK: "Open <link>{label}</link>",
        },
      },
    });

    const result = innerIntl.get("RICH_LINK", {
      label: "docs",
      link: chunks => React.createElement("a", { href: "/docs" }, chunks),
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(typeof result.defaultMessage).toBe("function");
    expect(typeof result.d).toBe("function");
    expect(result[0].type).toBe("span");
    expect(result[0].props[dataKey]).toBe("RICH_LINK");
    expect(result[0].props.children[0]).toBe("Open ");
    expect(result[0].props.children[1].type).toBe("a");
    expect(result[0].props.children[1].props.children).toEqual(["docs"]);
  });

  test("malformed rich tags warn and return legacy plain formatting", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          MALFORMED_RICH: "Open <link>{label}</strong>",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("MALFORMED_RICH", {
      label: "docs",
      link: chunks => React.createElement("a", null, chunks),
    })).toBe("Open <link>docs</strong>");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal rich format message failed for key='MALFORMED_RICH'.",
      expect.any(String)
    );
  });

  test("rich formatter failures warn and return legacy plain formatting", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          THROWING_RICH: "Open <link>docs</link>",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("THROWING_RICH", {
      link: () => {
        throw new Error("formatter failed");
      },
    })).toBe("Open <link>docs</link>");
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal rich format message failed for key='THROWING_RICH'.",
      expect.any(String)
    );
  });

  test("key-present formatting failures stay on the locale message path", () => {
    const warningHandler = jest.fn();
    const innerIntl = new ReactIntlUniversal();
    innerIntl.init({
      currentLocale: "en-US",
      locales: {
        "en-US": {
          BROKEN_LOCALE: "Broken {name",
        },
      },
      warningHandler,
    });

    expect(innerIntl.get("BROKEN_LOCALE", { name: "Tony" }).defaultMessage("Fallback {name}")).toBe(
      "Broken {name"
    );
    expect(warningHandler).toHaveBeenCalledWith(
      "react-intl-universal format message failed for key='BROKEN_LOCALE'.",
      expect.any(String)
    );
  });
});

test("Message with brace", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("BRACE1")).toBe("The format is {var}");
  expect(intl.get("BRACE2")).toBe("The format is ${var}");
});

test("Set specific locale with nested notation", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("NESTED.HELLO")).toBe("Hello World");
  expect(intl.get("NESTED.HELLO_NAME", { name: "World" })).toBe("Hello, World");
});

test("react-intl mirror API formatMessage:variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const name = "Tony";
  expect(
    intl.formatMessage(
      { id: "HELLO", defaultMessage: `Hello, {name}` },
      { name }
    )
  ).toBe(intl.get("HELLO", { name }));
});

test("react-intl mirror API formatMessage:defaultMessage", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.formatMessage({ id: "not-exist-key" })).toBe(
    intl.get("not-exist-key")
  );
});

test("react-intl mirror API formatHTMLMessage:variable", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.formatHTMLMessage(
    { id: "TIP_VAR", defaultMessage: React.createElement("div") },
    {
      message: "your message"
    }
  );
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("react-intl mirror API formatHTMLMessage:defaultMessage", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.formatHTMLMessage({
    id: "not-exist-key",
    defaultMessage: React.createElement("div", { className: 'test' })
  });

  expect(reactEl.type).toBe('div');
  expect(reactEl.props.className).toBe('test');

});

test("HTML Message without variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP");
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span>HTML</span>"
  );
});

test("HTML Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", { message: "your message" });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("HTML Message without variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP");
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span>HTML</span>"
  );
});

test("HTML Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "your message"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>your message</span>"
  );
});

test("HTML Message with variables in tag attributes", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR_ATTR", {
    message: "your message"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span style='color:red'>your message</span>"
  );

  reactEl = intl.getHTML("TIP_VAR_ATTR", {
    message: "<script>alert(1)</script>"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is <span style='color:red'>&lt;script&gt;alert(1)&lt;/script&gt;</span>"
  );
});

test("HTML Message with XSS attack", () => {
  intl.init({ locales, currentLocale: "en-US" });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "<sctipt>alert(1)</script>"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span>&lt;sctipt&gt;alert(1)&lt;/script&gt;</span>"
  );
});

test("HTML Message with disable escape html", () => {
  intl.init({ locales, currentLocale: "en-US", escapeHtml: false });
  let reactEl = intl.getHTML("TIP_VAR", {
    message: "<sctipt>alert(1)</script>"
  });
  expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
    "This is<span><sctipt>alert(1)</script></span>"
  );
});

test("Message with Date", () => {
  let start = new Date("Fri Apr 07 2017 17:08:33");
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SALE_START", {
      start: start
    })
  ).toBe("Sale begins 4/7/2017");
  expect(
    intl.get("SALE_END", {
      start: start
    })
  ).toBe("Sale begins April 7, 2017");
});

test("Message with Time", () => {
  let expires = new Date("Fri Apr 07 2017 17:08:33");
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("COUPON", {
      expires: expires
    })
  ).toBe("Coupon expires at 5:08:33 PM");
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("COUPON", {
      expires: expires
    })
  ).toBe("优惠卷将在17:08:33过期");
});

test("Message with Currency", () => {
  let price = 123456.78;
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SALE_PRICE", {
      price: price
    })
  ).toBe("The price is $123,456.78");
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("SALE_PRICE", {
      price: price
    })
  ).toBe("售价¥123,456.78");
});

test("Message with plural", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("PHOTO", {
      num: 0
    })
  ).toBe("You have no photos.");
  expect(
    intl.get("PHOTO", {
      num: 1
    })
  ).toBe("You have one photo.");
  expect(
    intl.get("PHOTO", {
      num: 10
    })
  ).toBe("You have 10 photos.");

  intl.init({ locales, currentLocale: "zh-CN" });
  expect(
    intl.get("PHOTO", {
      num: 1
    })
  ).toBe("你有1张照片");
});

test("Message with skeleton", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.get("SKELETON_VAR", {
      value: 42.5
    })
  ).toBe("Increase by 42.5");

  expect(
    intl.get("SKELETON_VAR", {
      value: 42
    })
  ).toBe("Increase by 42.0");

  expect(
    intl.get("SKELETON_VAR", {
      value: 42.109
    })
  ).toBe("Increase by 42.11");

  expect(
    intl.get("SKELETON_SELECTORDINAL", {
      year: 2
    })
  ).toBe("It's my cat's 2nd birthday!");

  expect(
    intl.get("SKELETON_SELECTORDINAL", {
      year: 10
    })
  ).toBe("It's my cat's 10th birthday!");
})

test("Without default message, just return empty string", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key")).toBe("");
});

test("Should call handler when message is not defined", () => {
  const warningHandler = jest.fn();
  intl.init({
    locales, currentLocale: "en-US",
    warningHandler
  });
  intl.get("not-exist-key");
  expect(warningHandler).toHaveBeenLastCalledWith('react-intl-universal key \"not-exist-key\" not defined in en-US');
});

test("Default message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe(
    "this is default msg"
  );
  expect(intl.get("not-exist-key").d("this is default msg")).toBe(
    "this is default msg"
  );
});

test("Default message with nested key", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("NOT_EXIST_KEY.HELLO").defaultMessage("Hello World")).toBe("Hello World");
});

test("Default message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe(
    "this is default msg"
  );
});

test("Default HTML message", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(
    intl.getHTML("not-exist-key").defaultMessage("this is default msg")
  ).toBe("this is default msg");
});

test("Get locale from cookie", () => {
  document.cookie = "lang=en-US";
  document.cookie = "other=1";
  expect(intl.getLocaleFromCookie({ cookieLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from localStorage", () => {
  localStorage.setItem("lang", "en-US");
  expect(intl.getLocaleFromLocalStorage({ localStorageLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from URL", () => {
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe(undefined);

  window.history.pushState({}, '', `?lang=en-US`);
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from browser", () => {
  expect(intl.getLocaleFromBrowser()).toBe("en-US");
});

test("Determine Locale", () => {
  expect(intl.determineLocale()).toBe("en-US");
  document.cookie = "lang=zh-CN";
  document.cookie = "other=1";
  expect(intl.determineLocale({ cookieLocaleKey: "lang" })).toBe("zh-CN");
});

test("Get dot key variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("DOT.HELLO")).toBe("Hello World");
});

test("Get init options", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const { currentLocale } = intl.getInitOptions();
  expect(currentLocale).toBe("en-US");
});

test("load mutiple locale data without overriding existing one", () => {
  intl.init({ locales, currentLocale: "en-US" });
  const localesMore = {
    "en-US": enUSMore,
  };
  intl.load(localesMore);
  expect(intl.get("SIMPLE")).toBe("Simple");
  expect(intl.get("MORE")).toBe("More data");
});

test("Uses fallback locale if key not found in currentLocale", () => {
  intl.init({ locales, currentLocale: "zh-CN", fallbackLocale: "en-US" });
  expect(intl.get("ONLY_IN_ENGLISH")).toBe("ONLY_IN_ENGLISH");
});

test("Uses default message if key not found in fallbackLocale", () => {
  intl.init({ locales, currentLocale: "zh-CN", fallbackLocale: "en-US" });
  expect(intl.get("not-exist-key").defaultMessage("this is default msg")).toBe("this is default msg");
});

test("Resolve language url if currentLocale was matched", async () => {
  const result = await intl.init({ locales, currentLocale: "en" });
  expect(result).toBe(undefined);
});

test("Resolve directly if the environment is not browser", async () => {
  const createElement = window.document.createElement;
  Object.defineProperty(window.document, 'createElement', {
    writable: true,
    configurable: true,
    value: undefined,
  });
  jest.resetModules();
  const { default: ReactIntlUniversal } = await require('../src/ReactIntlUniversal');
  const nextIntl = new ReactIntlUniversal();
  const result = await nextIntl.init({ locales, currentLocale: "zh-CN" });
  Object.defineProperty(window.document, 'createElement', {
    writable: true,
    configurable: true,
    value: createElement,
  });
  expect(result).toBe(undefined);
});

describe("Exceptional cases", () => {
  let innerIntl;
  beforeEach(() => {
    innerIntl = new ReactIntlUniversal();
  });
  test("should call intl.init before render", () => {
    const warningHandler = jest.spyOn(console, 'warn');
    innerIntl.get("SIMPLE");
    expect(warningHandler).toHaveBeenCalledWith(`react-intl-universal locales data \"null\" not exists.Check if the key \"SIMPLE\" is used before it is initialized. More info: https://github.com/alibaba/react-intl-universal/issues/144#issuecomment-1345193138`);
  });
})

describe("Test for debug mode", () => {
  let innerIntl;
  beforeEach(() => {
    innerIntl = new ReactIntlUniversal();
  });
  test("should output key by using get method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.get("SIMPLE").props[dataKey]).toBe("SIMPLE");
  });
  test("should output string by using get method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: false });
    expect(innerIntl.get("SIMPLE")).toBe("简单");
  });
  test("should output key by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.getHTML("TIP").props[dataKey]).toBe("TIP");
  });
  test("should return original DOM without key by using getHTML method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: false });
    expect(innerIntl.getHTML("TIP").props[dataKey]).toBeUndefined();
  });
  test("should return html with variables by using getHTML method if debug mode is false", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: false });
    let reactEl = innerIntl.getHTML("TIP_VAR", {
      message: "your message"
    });
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is<span>your message</span>"
    );
  });
  test("should return html with variables by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: true });
    const reactEl = innerIntl.getHTML("TIP_VAR", {
      message: "your message"
    });
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is<span>your message</span>"
    );
    expect(reactEl.props[dataKey]).toBe("TIP_VAR");
  });
  test("should return html without variables by using getHTML method if debug mode is true", () => {
    innerIntl.init({ locales, currentLocale: "en-US", debug: true });
    let reactEl = innerIntl.getHTML("TIP");
    expect(reactEl.props.dangerouslySetInnerHTML.__html).toBe(
      "This is <span>HTML</span>"
    );

    expect(reactEl.props[dataKey]).toBe("TIP");
  });
  test("should has defaultMessage method in after get calling", () => {
    innerIntl.init({ locales, currentLocale: "zh-CN", debug: true });
    expect(innerIntl.get("TIP").d).not.toBeUndefined();
  });
});


describe("Test for formatList", () => {
  const element = React.createElement("div", { className: 'test' });

  test("formatList should format string array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with disjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "disjunction"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', or ',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      ", ",
      "str2",
      ", ",
      element,
    ]);
  });

  test("formatList should format string array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      '、',
      'str2',
      '、',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      '、',
      "str2",
      '、',
      element,
    ]);
  });

  test("formatList should format string array with conjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "conjunction"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', and ',
      'str3',
    ]);
  });

  test("formatList should format string array with unit type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "unit"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with short style correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      style: "short"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', & ',
      'str3',
    ]);
  });

  test("formatList should format string array with narrow style correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      style: "narrow"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', ',
      'str3',
    ]);
  });

  test("formatList should format string array with combination of type and style options", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ], {
      type: "disjunction",
      style: "short"
    })).toEqual([
      'str1',
      ', ',
      'str2',
      ', or ',
      'str3',
    ]);
  });

  test("formatList should handle empty array correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([])).toEqual([]);
  });

  test("formatList should handle single element array correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList(["str1"])).toEqual(["str1"]);
  });

  test("formatList should handle two element array correctly with en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      ', ',
      'str2',
    ]);
  });

  test("formatList should handle two element array correctly with zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      '、',
      'str2',
    ]);
  });

  test("formatList should handle two element array with disjunction type correctly", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatList([
      "str1",
      "str2",
    ], {
      type: "disjunction"
    })).toEqual([
      'str1',
      ' or ',
      'str2',
    ]);
  });

  test("formatList should format string array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
      "str3",
    ])).toEqual([
      'str1',
      '、',
      'str2',
      '、',
      'str3',
    ]);
  });

  test("formatList should format React component array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
      element,
    ])).toEqual([
      "str1",
      '、',
      "str2",
      '、',
      element,
    ]);
  });

  test("formatList should handle two element array correctly with ja-JP locale", () => {
    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatList([
      "str1",
      "str2",
    ])).toEqual([
      'str1',
      '、',
      'str2',
    ]);
  });

});


describe("Test for getColon", () => {
  beforeEach(() => {
    intl.init({ locales, currentLocale: "en-US" });
  });

  test("should return half-width colon for non-full-width locales", () => {
    expect(intl.getColon()).toEqual(": ");
  });

  test("should return full-width colon for full-width locales", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.getColon()).toEqual("：");

    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.getColon()).toEqual("：");

    intl.init({ locales, currentLocale: "ko-KR" });
    expect(intl.getColon()).toEqual("：");
  });
});


describe("Test for formatParentheses", () => {
  beforeEach(() => {
    intl.init({ locales, currentLocale: "en-US" });
  });

  test("should return half-width parentheses for non-full-width locales", () => {
    expect(intl.formatParentheses("test")).toEqual(["(", "test", ")"]);
  });

  test("should return full-width parentheses for full-width locales", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);

    intl.init({ locales, currentLocale: "ja-JP" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);

    intl.init({ locales, currentLocale: "ko-KR" });
    expect(intl.formatParentheses("test")).toEqual(["（", "test", "）"]);
  });

  test("should handle different input types", () => {
    expect(intl.formatParentheses("")).toEqual(["(", "", ")"]);
    expect(intl.formatParentheses(123)).toEqual(["(", 123, ")"]);
    expect(intl.formatParentheses(null)).toEqual(["(", null, ")"]);
  });
});


describe("Test for formatNumber", () => {

  test("should format number correctly for en-US locale", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(1234567)).toBe("1,234,567");
    expect(intl.formatNumber(1234.567)).toBe("1,234.567");
    expect(intl.formatNumber(0)).toBe("0");
  });

  test("should format number correctly for zh-CN locale", () => {
    intl.init({ locales, currentLocale: "zh-CN" });
    expect(intl.formatNumber(1234567)).toBe("1,234,567");
    expect(intl.formatNumber(1234.567)).toBe("1,234.567");
    expect(intl.formatNumber(0)).toBe("0");
  });

  test("should format number correctly for de-DE locale", () => {
    intl.init({ locales, currentLocale: "de-DE" });
    expect(intl.formatNumber(1234.567)).toBe("1.234,567");
  });

  test("should format number correctly for fr-FR locale", () => {
    intl.init({ locales, currentLocale: "fr-FR" });
    expect(intl.formatNumber(1234.567)).toBe("1 234,567");
  });

  test("should handle edge cases", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(NaN)).toBeNaN();
    // Intl.NumberFormat formats Infinity as "∞" string
    expect(intl.formatNumber(Infinity)).toBe("∞");
    expect(intl.formatNumber(-Infinity)).toBe("-∞");
    expect(intl.formatNumber(null)).toBeNull();
    expect(intl.formatNumber(undefined)).toBeUndefined();
    expect(intl.formatNumber("not a number")).toBe("not a number");
  });

  test("should handle large numbers", () => {
    intl.init({ locales, currentLocale: "en-US" });
    expect(intl.formatNumber(1e15)).toBe("1,000,000,000,000,000");
  });
});
