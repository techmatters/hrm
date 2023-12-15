/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import * as parsec from 'typescript-parsec';
import { TokenKind, lexer } from './tokenizer';
import differenceInHours from 'date-fns/differenceInHours';
import differenceInDays from 'date-fns/differenceInDays';
import parseISO from 'date-fns/parseISO';
import { isCaseOpen, isContactOwner, isCounselorWhoCreated } from '../helpers';
import type { TargetKind } from '../actions';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { TKConditionsSet, TKConditionsSets } from '../rulesMap';

/*****************************************************************
 * Predicates (apply)
 *
 * Since we only need to convert each predicate function of type (performer: TwilioUser, target: any) => boolean
 * We don't need the apply to be turned into complicated data structures. This could change if we ever need a real AST
 ****************************************************************/
type PredicateContext = {
  curentTimestamp: Date;
};
type PredicateEvaluator = (
  performer: TwilioUser,
  target: any,
  ctx: PredicateContext,
) => boolean;

const applyIsSupervisor =
  (_value: parsec.Token<TokenKind.IsSupervisor>): PredicateEvaluator =>
  user =>
    user.isSupervisor;

const applyEveryone =
  (_value: parsec.Token<TokenKind.Everyone>): PredicateEvaluator =>
  () =>
    true;

const applyCreatedHoursAgo =
  (value: [parsec.Token<TokenKind.CreatedHoursAgo>, number]): PredicateEvaluator =>
  (_user, target, ctx) =>
    differenceInHours(ctx.curentTimestamp, parseISO(target.createdAt)) < value[1];

const applyCreatedDaysAgo =
  (value: [parsec.Token<TokenKind.CreatedDaysAgo>, number]): PredicateEvaluator =>
  (_user, target, ctx) =>
    differenceInDays(ctx.curentTimestamp, parseISO(target.createdAt)) < value[1];

const applyIsOwner =
  (_value: parsec.Token<TokenKind.IsOwner>): PredicateEvaluator =>
  (user, target) =>
    isContactOwner(user, target);

const applyIsCreator =
  (_value: parsec.Token<TokenKind.IsCreator>): PredicateEvaluator =>
  (user, target) =>
    isCounselorWhoCreated(user, target);

const applyIsCaseOpen =
  (_value: parsec.Token<TokenKind.IsCaseOpen>): PredicateEvaluator =>
  (user, target) =>
    isCaseOpen(target);

/*****************************************************************
 * Parsers
 ****************************************************************/

const parseNumber = parsec.apply(parsec.tok(TokenKind.Number), v => +v.text);
const parseLParen = parsec.tok(TokenKind.LParen);
const parseRParen = parsec.tok(TokenKind.RParen);

const parseIsSupervisorPredicate = parsec.apply(
  parsec.tok(TokenKind.IsSupervisor),
  applyIsSupervisor,
);
const parseEveryonePredicate = parsec.apply(
  parsec.tok(TokenKind.Everyone),
  applyEveryone,
);
const parseCreatedHoursAgoPredicate = parsec.apply(
  parsec.seq(
    parsec.tok(TokenKind.CreatedHoursAgo),
    parsec.kmid(parseLParen, parseNumber, parseRParen),
  ),
  applyCreatedHoursAgo,
);
const parseCreatedDaysAgoPredicate = parsec.apply(
  parsec.seq(
    parsec.tok(TokenKind.CreatedDaysAgo),
    parsec.kmid(parseLParen, parseNumber, parseRParen),
  ),
  applyCreatedDaysAgo,
);
const parseIsOwnerPredicate = parsec.apply(parsec.tok(TokenKind.IsOwner), applyIsOwner);
const parseIsCreatorPredicate = parsec.apply(
  parsec.tok(TokenKind.IsCreator),
  applyIsCreator,
);
const parseIsCaseOpenPredicate = parsec.apply(
  parsec.tok(TokenKind.IsCaseOpen),
  applyIsCaseOpen,
);

/*****************************************************************
 * Syntax
 ****************************************************************/

const COMMON_PREDICATE = parsec.rule<TokenKind, PredicateEvaluator>();
COMMON_PREDICATE.setPattern(
  parsec.alt(
    parseIsSupervisorPredicate,
    parseEveryonePredicate,
    parseCreatedHoursAgoPredicate,
    parseCreatedDaysAgoPredicate,
  ),
);

const CONTACT_PREDICATE = parsec.rule<TokenKind, PredicateEvaluator>();
CONTACT_PREDICATE.setPattern(parsec.alt(COMMON_PREDICATE, parseIsOwnerPredicate));

const CASE_PREDICATE = parsec.rule<TokenKind, PredicateEvaluator>();
CASE_PREDICATE.setPattern(
  parsec.alt(COMMON_PREDICATE, parseIsCreatorPredicate, parseIsCaseOpenPredicate),
);

const POSTSURVEY_PREDICATE = COMMON_PREDICATE;

export const parseTKPredicate = (kind: TargetKind) => (input: string) => {
  try {
    const tokenized = lexer.parse(input);
    switch (kind) {
      case 'contact': {
        return parsec.expectSingleResult(
          parsec.expectEOF(CONTACT_PREDICATE.parse(tokenized)),
        );
      }
      case 'case': {
        return parsec.expectSingleResult(
          parsec.expectEOF(CASE_PREDICATE.parse(tokenized)),
        );
      }
      case 'postSurvey': {
        return parsec.expectSingleResult(
          parsec.expectEOF(POSTSURVEY_PREDICATE.parse(tokenized)),
        );
      }
      default: {
        throw new Error(`Invalid TargetKind provided: ${kind}`);
      }
    }
  } catch (err) {
    console.error(`Error at parseTKPredicate with kind: ${kind} and input: ${input}`);
    throw err;
  }
};

const parseTKPredicateSet =
  <T extends TargetKind>(kind: T) =>
  (conditionsSet: TKConditionsSet<T>) =>
    conditionsSet.map(parseTKPredicate(kind));

export const parseConditionsSets =
  <T extends TargetKind>(kind: T) =>
  (conditionsSets: TKConditionsSets<T>) =>
    conditionsSets.map(parseTKPredicateSet(kind));
