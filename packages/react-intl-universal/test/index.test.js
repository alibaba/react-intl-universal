import React from "react";
import cookie from "cookie";
import intl from "../src/index";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";
import enUSMore from "./locales/en-US-more";
import LocalStorageMock from "./util/LocalStorageMock";
global.localStorage = new LocalStorageMock;

const locales = {
  "en-US": enUS,
  "zh-CN": zhCN
};

test("Set specific locale", () => {
  intl.init({ locales, currentLocale: "zh-CN" });
  expect(intl.get("SIMPLE")).toBe("简单");
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("SIMPLE")).toBe("Simple");
});

test("Message with variables", () => {
  intl.init({ locales, currentLocale: "en-US" });
  expect(intl.get("HELLO", { name: "Tony" })).toBe("Hello, Tony");
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
  expect(warningHandler).lastCalledWith('react-intl-universal key \"not-exist-key\" not defined in en-US');
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
  document.cookie = cookie.serialize("lang", "en-US");
  expect(intl.getLocaleFromCookie({ cookieLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from localStorage", () => {
  localStorage.setItem("lang", "en-US");
  expect(intl.getLocaleFromLocalStorage({ localStorageLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from URL", () => {
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe(undefined);

  // change url in jsdom: https://github.com/facebook/jest/issues/890
  Object.defineProperty(window.location, "search", {
    writable: true,
    value: "?lang=en-US"
  });
  expect(intl.getLocaleFromURL({ urlLocaleKey: "lang" })).toBe("en-US");
});

test("Get locale from browser", () => {
  expect(intl.getLocaleFromBrowser()).toBe("en-US");
});

test("Determine Locale", () => {
  expect(intl.determineLocale()).toBe("en-US");
  document.cookie = cookie.serialize("lang", "zh-CN");
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

test("cache", () => {
  const key = "HELLO";
  const variables = { name: 'World' };
  const currentLocale = "en-US"
  const cacheKey = key + JSON.stringify(variables) + currentLocale;

  intl.init({ locales, currentLocale });
  
  expect(intl.get(key, variables)).toBe("Hello, World");
  expect(intl.cache[cacheKey]).toBe("Hello, World");
});