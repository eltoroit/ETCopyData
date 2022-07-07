/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

module.exports = {
  extends: ["eslint-config-salesforce-typescript"],
  parser: "@typescript-eslint/parser",
  rules: {
    "no-console": "off",
    "prettier/prettier": "off",
    "class-methods-use-this": "off",
    "@typescript-eslint/quotes": "off",
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/no-unused-vars": "Off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/member-ordering": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
  }
};
