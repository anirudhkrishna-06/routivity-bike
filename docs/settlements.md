# Settlements and Expenses: Current Frontend Inventory

## Purpose of this document

This document describes what the user currently sees after opening the **Settlements** item in the bottom navigation of a trip dashboard. It is an inventory of the existing frontend, not a redesign proposal.

The current screen is a combined money workspace. It contains:

1. An expense ledger.
2. A planned-versus-actual budget panel.
3. A settlement section that calculates who owes whom.
4. A settlement transfer workflow.
5. Settlement round history.

The main composition is:

`MoneySettlementWorkspace`

→ `MoneyWorkspace`

→ expense ledger, budget panel, expense form

→ settlement divider

→ `SettlementWorkspace`

→ balances, suggested transfers, pending transfers, round history

The screen is rendered inside the existing trip dashboard shell, so the trip header and bottom navigation remain visible. Clicking the bottom-bar **Settlements** button changes the active dashboard workspace; it does not navigate to a separate URL.

## 1. Bottom navigation entry point

The trip dashboard bottom bar contains the following navigation structure:

- Itinerary
- Budget
- A central add-expense button with a plus icon
- Settlements
- Analytics

Clicking **Settlements** makes the Settlements tab active and renders the combined money and settlement workspace.

The central plus button is available from the trip dashboard and opens the expense-entry sheet. The Settlements screen itself does not currently show a separate “Add expense” button in its heading or ledger header. To add a new expense while viewing Settlements, the user uses the central plus button in the bottom navigation.

## 2. Overall page order

From top to bottom, the current screen is ordered as follows:

1. Expense overview heading.
2. Expense ledger.
3. Budget panel.
4. A horizontal divider labeled **SETTLEMENTS**.
5. Settlement heading and **Start round** button.
6. Error message, if one exists.
7. Per-person balance cards.
8. Suggested transfer card.
9. Pending transfer rows, when transfers have been recorded.
10. Close-round control, when a round is open.
11. Round history, when at least one round exists.

The settlement content is therefore below the full expense and budget content. On a long trip or a trip with many expenses, the user must scroll past the ledger and budget panel before reaching the transfer workflow.

## 3. Expense overview heading

The first section is the expense workspace heading.

Visible text:

- **Every paisa accounted for.**
- **Fast entry, shared balances, and a server-backed ledger.**

This heading explains that the section is intended to track shared spending and calculate balances from the shared ledger.

There is no total-spend number in this heading. The current total is not presented as a prominent summary metric here; the user sees individual expense amounts in the ledger and individual net balances later in the settlement section.

## 4. Expense ledger section

The ledger is a bordered card with the label **LEDGER**.

### 4.1 Ledger header

The ledger header displays one of two titles:

- When expenses exist: **N recorded expenses**, where `N` is the number of expenses matching the current filter.
- When no matching expenses exist: **No expenses recorded yet**.

The header also contains a category filter with a filter icon.

The filter options are:

- All categories
- Food
- Stay
- Pre Req
- Fuel
- Parking
- Tickets
- Shopping
- Custom

The filter changes which rows are displayed and also changes the recorded-expense count in the heading.

### 4.2 Expense row layout

Each expense appears as a horizontal ledger row separated by a hairline divider.

The row contains:

1. A small wallet icon inside a rounded colored square.
2. The expense title.
3. A secondary line containing the expense date and category.
4. The expense amount.
5. Actions for editing or reversing the expense, if it is active.

The expense title is:

- The optional description entered by the user, when available.
- Otherwise, the category label.

The secondary line uses the raw stored date and the friendly category name, for example:

`2026-11-30 · Food`

The amount is formatted as Indian currency, for example `₹1,250.00`.

### 4.3 Expense row actions

For an active expense, the row has two small controls:

- **Edit**: opens the expense form with the existing expense values prefilled.
- **Reverse**: opens a browser prompt asking, **Why are you reversing this expense?**

Reversal requires a non-empty reason. A reversed expense is not physically removed from the visible ledger. Instead:

- The row becomes visually faded.
- The row displays **reversed**.
- Edit and Reverse controls are no longer shown.

Reversed expenses are excluded from active balance calculations and active spend calculations, but their historical record remains visible in the ledger.

### 4.4 Empty ledger state

When there are no expenses matching the selected filter, the ledger shows:

**Add the first expense to start calculating balances.**

This message is also used when the trip has no expenses at all. The current ledger does not contain an inline add button next to this message; the user must use the bottom-bar plus button.

### 4.5 Loading and error behavior

The money workspace fetches the trip money data when it mounts. While the data is loading, the page does not currently show a dedicated ledger skeleton inside the component.

If the money request fails, an error message is stored in the workspace. The page has an existing money-error visual treatment for errors, although the primary visible error placement depends on which child component renders it.

The workspace also listens for:

- The browser coming back online, which triggers pending mutation flushing and a reload.
- The app-wide `routivity-refresh` event, which triggers a reload.

## 5. Budget panel inside the Settlements screen

After the ledger, the page shows a budget card. This is part of the expense workspace and appears before the settlement divider.

### 5.1 Budget header

The card is labeled **BUDGET** and titled:

**Planned versus actual**

The header also shows:

**Rules are estimates**

This makes clear that the budget rules are planning values rather than hard spending limits.

### 5.2 Existing budget rule rows

Each budget rule row contains:

- The category name.
- The rule type and effective date.
- Actual spend versus planned spend.
- A status label.

The status values are:

- **within**: actual spend is below 80% of the planned amount.
- **approaching**: actual spend is at least 80% but has not exceeded the plan.
- **over**: actual spend is greater than the planned amount.

The displayed value follows this pattern:

`actual amount / planned amount`

For example:

`₹4,500.00 / ₹8,000.00   within`

### 5.3 Add-budget-rule form

The bottom of the budget card contains a compact form with:

- Category selector.
- Rule type selector.
- Planned amount input.
- Effective-from date input.
- **Save rule** button.

Rule types currently offered:

- Per day
- Per night
- Total
- Derived

After saving, the form displays a small confirmation or error message. A successful save clears the amount input and refreshes the money data.

## 6. Settlement divider

The expense and budget area is followed by a horizontal divider with the label:

**SETTLEMENTS**

This divider is the only explicit visual separation between the expense-tracking portion and the transfer-settlement portion of the page.

## 7. Settlement heading and start-round action

The settlement section begins with the label:

**SETTLEMENT**

The main heading is:

**Settle without guesswork.**

The supporting text is:

**Pending transfers never change confirmed balances.**

The heading row contains a primary button:

**Start round**

The button includes a currency-circle icon.

### 7.1 What Start round does

Starting a round captures a snapshot of the current participant balances. This creates the reference point for the settlement process.

The current workflow expects the user to start a round before recording suggested transfers. If the user attempts to record a transfer without an open round, the page displays:

**Start a settlement round first.**

The start operation is protected with an idempotency key so a retry does not unintentionally create a duplicate result.

## 8. Settlement error area

If the settlement API returns an error, it appears as a money-error panel below the settlement heading.

Possible errors include:

- Unable to load settlements.
- Unable to start round.
- Unable to record transfer.
- Unable to confirm transfer.
- Unable to close round.
- Start a settlement round first.
- Transfer exceeds the round's outstanding balance.
- Settlement round not found or already closed.

## 9. Per-person balance cards

The balance area displays one card per trip participant.

Each participant card contains:

1. The participant name.
2. The total amount that participant has paid.
3. The total amount that participant is responsible for sharing.
4. The participant's net balance.

The secondary line uses this format:

`Paid ₹X · Share ₹Y`

The net amount is displayed on the right with a sign:

- A green positive amount, such as `+₹1,250.00`, means the participant paid more than their share and is owed money by the group.
- A terracotta/negative amount, such as `-₹1,250.00`, means the participant owes money to the group or to other participants.

### 9.1 Balance calculation in plain language

For each participant:

`net balance = amount paid - amount owed as their share`

Examples:

- If someone paid `₹3,000` and their share was `₹2,000`, their net is `+₹1,000`. They are a creditor and should receive money.
- If someone paid `₹500` and their share was `₹2,000`, their net is `-₹1,500`. They are a debtor and should pay money.
- If someone paid exactly their share, their net is `₹0` and they do not need to transfer money.

Confirmed settlement transfers are included in the balance calculation so that completed payments reduce the remaining obligation.

## 10. Suggested transfers card

The next card is a settlement transfer card.

Its header contains:

- The label **SUGGESTED TRANSFERS**.
- A dynamic title.
- A refresh icon button.

The dynamic title is:

- **Fewest payments first** when there are suggested transfers.
- **All balances are settled** when no transfers are needed.

### 10.1 Meaning of suggested transfers

Each suggested transfer is a direct instruction:

`Person A → Person B   ₹Amount   Record`

The sender is the person who owes money. The receiver is the person who paid more than their share and is owed money.

The algorithm attempts to reduce the number of payments needed. For smaller groups, it searches for a minimum-transfer solution. For larger groups, it uses a greedy matching approach between debtors and creditors.

The goal is not to list every expense again. The goal is to compress all expense and share data into the smallest practical set of “who pays whom” instructions.

### 10.2 Record action

The **Record** button does not immediately mark the transfer as complete. It creates a pending transfer inside the current settlement round.

The action is disabled while a settlement operation is pending.

The recorded amount must not exceed either:

- The sender's remaining outstanding debt in the round.
- The receiver's remaining outstanding credit in the round.

The sender and receiver must be different participants.

## 11. Pending transfer rows

After a suggested transfer is recorded, it appears in the same transfer card as a pending row.

The row changes the wording to:

`Pending: Person A → Person B   ₹Amount   Confirm`

The pending row has a **Confirm** button with a check icon.

Pending transfers intentionally do not change confirmed balances. This is why the settlement section explains:

**Pending transfers never change confirmed balances.**

This allows the group to record an intended payment first and confirm it only after the real-world payment has happened.

## 12. Confirm action

The **Confirm** button marks a pending transfer as confirmed.

After confirmation:

- The transfer status becomes confirmed.
- The current user is recorded as the confirmer.
- A confirmation timestamp is stored.
- The page reloads settlement data.
- The confirmed transfer contributes to the balance calculation.

Confirmed transfers are no longer shown as pending rows.

## 13. Close round action

When a settlement round is open, the transfer card can show:

**Close round**

Closing the round marks it as closed. A closed round cannot accept new transfer records.

The current page does not show a prominent separate round-status banner above the transfer list. The open-round state is communicated mainly through the available controls and the round history.

## 14. Round history

Round history appears only when at least one settlement round exists.

The card is labeled:

**ROUND HISTORY**

Each history row contains:

- The round creation date.
- The round status.

The history does not currently show:

- The total amount settled in that round.
- The number of transfers.
- A participant-by-participant breakdown.
- A reopen action.
- A detailed round view.

## 15. Expense-entry sheet opened from the bottom plus button

Although the expense form is not directly embedded as a visible button in the settlement header, it is central to the page because expenses drive the balance calculations.

The bottom navigation plus button or an expense row's **Edit** button opens the expense sheet.

The sheet is a modal with a dimmed and blurred background and an animated entrance. It can be closed with the X button or by clicking outside the sheet.

### 15.1 Sheet header

For a new expense, the sheet title is:

**Enter the amount**

For an existing expense, it also shows:

**EDIT EXPENSE**

The sheet has a circular close button.

### 15.2 Amount field

The first field is a large currency amount input.

Placeholder:

`₹ 0.00`

When there is one payer, changing the amount keeps the single payer amount synchronized automatically.

### 15.3 Category selector

The form displays eight colored category buttons:

- Food
- Stay
- Pre Req
- Fuel
- Parking
- Tickets
- Shopping
- Custom

The selected category has a visible check indicator.

### 15.4 Description and date

The form includes:

- **What was it for? (optional)** text field.
- Required expense date field.

The date defaults to the trip's current date value supplied by the server, or the browser's current date as a fallback.

### 15.5 Stay-specific fields

When the category is **Stay**, and the trip has stay activities available, the form displays:

**Link this stay**

The user can choose a stay from a dropdown. Choosing a stay can automatically fill the description if the description is empty.

### 15.6 Fuel-specific fields

When the category is **Fuel**, the form displays:

- Litres (optional)
- Odometer km (optional)

These values support later fuel-related analysis.

### 15.7 Paid by section

The form includes a **Paid by** section.

Each payer row contains:

- A participant selector.
- An amount paid input.

The first payer defaults to the current user when available. The user can add another payer with:

**Add payer**

Multiple payers are supported. The total of all payer amounts must equal the expense amount exactly.

### 15.8 Shared by section

The form includes a **Shared by** section with a split method selector.

Split methods:

- Equal
- Exact amounts
- Percentages

The participant list contains a circular checkbox for each person in the trip.

For equal splitting, the expense is divided among the selected participants.

For exact amounts, each selected person receives an amount input.

For percentages, each selected person receives a percentage input. Percentages must total 100% before the computed shares reconcile.

### 15.9 Expense validation

The form shows an error if:

- No amount is entered.
- No participant is selected.
- Shared amounts do not equal the expense amount.
- Paid amounts do not equal the expense amount.
- The server rejects the mutation.

The save operation is queued locally and then flushed to the server. The interface shows **Saving…** while the mutation is pending.

### 15.10 Save behavior

The footer contains a primary **Save** button.

On success:

- The sheet closes.
- The ledger reloads.
- Balances can be recalculated.
- Suggested settlements can change.

Editing uses the same form and updates the existing expense rather than creating a separate visible row.

## 16. What the current screen communicates about “who gives to whom”

The current user journey is:

1. Someone records an expense.
2. The expense records who paid and who shared the cost.
3. The page calculates each participant's net balance.
4. Positive participants are owed money.
5. Negative participants owe money.
6. Suggested transfers pair debtors with creditors.
7. The user starts a settlement round to freeze the balance reference point.
8. The user records a suggested transfer.
9. The transfer remains pending until someone confirms it.
10. Confirmation updates the settled balances.
11. The round can be closed and remains visible in round history.

In practical terms, a transfer row is the actionable answer to the question:

**Who has to give how much to whom?**

The current UI expresses that answer with a simple arrow:

`Sender → Receiver`

## 17. Current screen limitations relevant to a redesign

The current frontend has these important structural characteristics:

- Expenses, budget planning, and settlements are all on one long page.
- The settlement section is below the expense ledger and budget panel.
- There is no top-level settlement summary showing total outstanding debt.
- There is no explicit “you owe” versus “you are owed” summary at the top.
- The user must infer debtor and creditor meaning from positive and negative signs.
- Suggested transfers show the result, but do not explain which expenses created the obligation.
- There is no dedicated detail view for a transfer.
- Pending and confirmed states are shown as rows rather than as a clear settlement timeline.
- Round history is minimal and cannot be expanded.
- There is no visible add-expense CTA inside the ledger header.
- The empty ledger message does not offer a direct action.
- Reversing an expense uses a browser prompt for the reason.
- Reversed expenses remain in the ledger as faded historical entries.
- The page does not currently provide a shareable settlement summary or settlement receipt.
- The user cannot currently reverse a confirmed settlement transfer from this component.
- Settlement transfer reversal exists at the action/API level and is owner-restricted, but there is no visible reversal control in the current Settlement workspace.

## 18. Useful redesign questions

When reforming this page, the screenshots and this inventory should help answer:

- Should expenses and settlements remain in one page or become separate views?
- Should the user see a total outstanding amount immediately?
- Should the primary view be “You owe,” “You are owed,” or “Everyone’s balances”?
- Should each transfer explain the underlying expenses?
- Should recording and confirming a transfer be one action or two deliberate steps?
- Should a settlement round be visible as a timeline or checklist?
- Should a user be able to mark a transfer as paid for themselves before others confirm it?
- Should the app support splitting a single settlement across multiple partial payments?
- Should a closed round produce a receipt, share link, export, or summary?
- Should adding an expense be available directly inside the settlement page?
- How should reversed expenses and corrected expenses be communicated?
- What should happen when a new expense is added after a settlement round has started?

