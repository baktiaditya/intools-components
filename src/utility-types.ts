/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * DeepPartial
 * @desc Partial that works for deeply nested structure
 * @see https://github.com/piotrwitek/utility-types/blob/v3.11.0/src/mapped-types.ts#L484-L516
 * @example
 *   // Expect: {
 *   //   first?: {
 *   //     second?: {
 *   //       name?: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   };
 *   type PartialNestedProps = DeepPartial<NestedProps>;
 */
export type DeepPartial<T> = { [P in keyof T]?: _DeepPartial<T[P]> };
/** @private */
export type _DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepPartialArray<U>
    : T extends object
      ? DeepPartial<T>
      : T | undefined;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepPartialArray<T> extends Array<_DeepPartial<T>> {}

/**
 * Optional
 * @desc From `T` make a set of properties by key `K` become optional
 * @see https://github.com/piotrwitek/utility-types/blob/v3.11.0/src/mapped-types.ts#L540-L560
 * @example
 *    type Props = {
 *      name: string;
 *      age: number;
 *      visible: boolean;
 *    };
 *
 *    // Expect: { name: string; age?: number; visible?: boolean; }
 *    type Props = Optional<Props, 'age' | 'visible'>;
 */
export type Optional<T extends object, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * AugmentedRequired
 * @desc From `T` make a set of properties by key `K` become required
 * @see https://github.com/piotrwitek/utility-types/blob/v3.11.0/src/mapped-types.ts#L600-L619
 * @example
 *    type Props = {
 *      name?: string;
 *      age?: number;
 *      visible?: boolean;
 *    };
 *
 *    // Expect: { name?: string; age: number; visible: boolean; }
 *    type Props = AugmentedRequired<Props, 'age' | 'visible'>;
 */
export type AugmentedRequired<T extends object, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

/**
 * DeepAugmentedRequired
 * @example
 * type Props = {
 *   age?: number;
 *   child?: {
 *     name?: string;
 *   };
 *   name?: string;
 *   visible?: boolean;
 * };
 *
 * // Expect: { name?: string; age: number; visible: boolean; child: {name: string} }
 * type Props = AugmentedRequired<Props, 'age' | 'visible'| 'child.name'>;
 */

// Split "a.b.c" → ["a","b","c"]
type PathArray<S extends string> = S extends `${infer H}.${infer R}` ? [H, ...PathArray<R>] : [S];

// Core deep-required transformation
type DeepRequiredHelper<T, P extends readonly PropertyKey[]> = P extends [
  infer H extends keyof T,
  ...infer R extends PropertyKey[],
]
  ? Omit<T, H> & {
      [K in H]-?: DeepRequiredHelper<Required<T>[K], R>;
    }
  : T;

// Convert union → intersection
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

type IsPlainObject<T> = T extends object
  ? T extends (...args: unknown[]) => unknown
    ? false
    : T extends readonly unknown[]
      ? false
      : true
  : false;

type Inc<T extends unknown[]> = [unknown, ...T];

// Default MaxDepth = 5
type DotPaths<
  T,
  Prefix extends string = '',
  Depth extends unknown[] = [],
  MaxDepth extends number = 5,
> = Depth['length'] extends MaxDepth
  ? Prefix extends ''
    ? keyof T & string
    : Prefix
  : {
      [K in keyof T & string]: IsPlainObject<NonNullable<T[K]>> extends true
        ? Prefix extends ''
          ? K | DotPaths<NonNullable<T[K]>, `${K}.`, Inc<Depth>, MaxDepth>
          : `${Prefix}${K}` | DotPaths<NonNullable<T[K]>, `${Prefix}${K}.`, Inc<Depth>, MaxDepth>
        : Prefix extends ''
          ? K
          : `${Prefix}${K}`;
    }[keyof T & string];

export type DeepAugmentedRequired<T, P extends DotPaths<T>> = UnionToIntersection<
  P extends string ? DeepRequiredHelper<T, PathArray<P>> : never
>;

/**
 * DeepNonNullable
 * @desc NonNullable that works for deeply nested structure
 * @see https://github.com/piotrwitek/utility-types/blob/v3.11.0/src/mapped-types.ts#L447-L482
 * @example
 *   // Expect: {
 *   //   first: {
 *   //     second: {
 *   //       name: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first?: null | {
 *       second?: null | {
 *         name?: string | null |
 *         undefined;
 *       };
 *     };
 *   };
 *   type RequiredNestedProps = DeepNonNullable<NestedProps>;
 */
export type DeepNonNullable<T> = T extends (...args: any[]) => any
  ? T
  : T extends any[]
    ? _DeepNonNullableArray<T[number]>
    : T extends object
      ? _DeepNonNullableObject<T>
      : T;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepNonNullableArray<T> extends Array<DeepNonNullable<NonNullable<T>>> {}
/** @private */
export type _DeepNonNullableObject<T> = {
  [P in keyof T]-?: DeepNonNullable<NonNullable<T[P]>>;
};

/**
 * @see https://github.com/sindresorhus/type-fest/blob/v4.23.0/source/is-equal.d.ts
 */
export type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
  ? true
  : false;

type Filter<KeyType, ExcludeType> = IsEqual<KeyType, ExcludeType> extends true
  ? never
  : KeyType extends ExcludeType
    ? never
    : KeyType;

type ExceptOptions = {
  /** @default false */
  requireExactProps?: boolean;
};

/**
 * @see https://github.com/sindresorhus/type-fest/blob/v4.23.0/source/except.d.ts
 */
export type OmitStrict<
  ObjectType,
  KeysType extends keyof ObjectType,
  Options extends ExceptOptions = { requireExactProps: false },
> = {
  [KeyType in keyof ObjectType as Filter<KeyType, KeysType>]: ObjectType[KeyType];
} & (Options['requireExactProps'] extends true ? Partial<Record<KeysType, never>> : {});

/**
 * @see https://stackoverflow.com/a/49286056
 */
export type ValueOf<T> = T[keyof T];

/**
 * @see https://github.com/microsoft/TypeScript/issues/31474#issue-446101749
 */
export type ExtractStrict<T, U extends T> = Extract<T, U>;

export type ExcludeStrict<T, U extends T> = Exclude<T, U>;
