"use client";
import { MoneyWorkspace } from "./money-workspace";
import { SettlementWorkspace } from "./settlement-workspace";

export function MoneySettlementWorkspace({ tripId, openExpense }: { tripId: string; openExpense?: boolean }) {
  return <section className="money-settlement-workspace rise-in"><MoneyWorkspace tripId={tripId} openOnMount={openExpense}/><div className="money-settlement-divider"><span>SETTLEMENTS</span><i/></div><SettlementWorkspace tripId={tripId}/></section>;
}
