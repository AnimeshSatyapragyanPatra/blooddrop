export const BLOOD_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

/**
 * Blood group as a tap grid rather than a dropdown.
 *
 * There are only eight values and this is the field every screen turns on, so
 * showing all of them costs one row of space and saves a tap-scroll-tap — which
 * matters most on a phone, at a hospital, in a hurry. Built on real radio
 * inputs so keyboard and screen-reader behaviour comes for free.
 */
export default function BloodGroupPicker({
  value,
  onChange,
  name = "bloodGroup",
  groups = BLOOD_GROUPS,
  label = "Blood group",
  hint,
  required = false,
}) {
  return (
    <fieldset>
      <legend className="label">
        {label}
        {required && <span className="text-blood-600"> *</span>}
      </legend>

      <div className="grid grid-cols-4 gap-2">
        {groups.map((group) => {
          const selected = value === group;
          return (
            <label
              key={group}
              className={`relative grid cursor-pointer place-items-center rounded-xl border py-2.5 text-sm font-bold transition
                ${selected
                  ? "border-blood-600 bg-blood-600 text-white shadow-sm"
                  : "border-stone-200 bg-white text-stone-700 hover:border-blood-300 hover:bg-blood-50"}
                focus-within:ring-4 focus-within:ring-blood-100`}
            >
              <input
                type="radio"
                name={name}
                value={group}
                checked={selected}
                onChange={() => onChange(group)}
                className="absolute h-0 w-0 opacity-0"
              />
              {group}
            </label>
          );
        })}
      </div>

      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}
