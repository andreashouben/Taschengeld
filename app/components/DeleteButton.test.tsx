// @vitest-environment happy-dom
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteButton } from "./DeleteButton";

describe("DeleteButton", () => {
  it("zeigt zunächst nur das Lösch-Icon", () => {
    render(<DeleteButton onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Buchung löschen" })).toBeTruthy();
    expect(screen.queryByText("Löschen?")).toBeNull();
  });

  it("wechselt nach erstem Klick in den Bestätigungs-Modus", async () => {
    const user = userEvent.setup();
    render(<DeleteButton onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Buchung löschen" }));

    expect(screen.getByRole("button", { name: "Löschen bestätigen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  });

  it("ruft onConfirm beim Bestätigen auf", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteButton onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Buchung löschen" }));
    await user.click(screen.getByRole("button", { name: "Löschen bestätigen" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("kehrt nach Abbrechen in den Ausgangszustand zurück", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteButton onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Buchung löschen" }));
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByText("Löschen?")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("setzt den Zustand nach 3 Sekunden automatisch zurück", () => {
    vi.useFakeTimers();
    try {
      render(<DeleteButton onConfirm={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: "Buchung löschen" }));
      expect(screen.getByText("Löschen?")).toBeTruthy();

      act(() => { vi.advanceTimersByTime(3000); });

      expect(screen.queryByText("Löschen?")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
