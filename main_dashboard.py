# main_dashboard.py
import time
import streamlit as st

from modules.chat_module import chat_interface
from modules.mood_tracker import log_mood, display_mood_chart
from modules.smart_suggester import generate_suggestions
from modules.financial_advisor import load_portfolio, log_financials, suggest_investments
from modules.planner_engine import load_tasks, add_task, render_planner
from modules.avatar_controller import render_avatar, speak, avatar_style_selector
from modules.avatar_widget import avatar_card

st.set_page_config(page_title="Joud AI", page_icon="🧠", layout="wide")



def _init_state():
    # Persistent UI state keys
    st.session_state.setdefault("avatar_style", "Calm")  # Calm | Dark
    st.session_state.setdefault("auto_speak", True)
    st.session_state.setdefault("chat_history", [])
    st.session_state.setdefault("last_mood", None)


def overview_tab():
    st.subheader("🎤 Joud — Live Avatar")
    avatar_card(height=380)


def chat_tab():
    left, right = st.columns([0.42, 0.58], gap="large")

    with left:
        st.subheader("Joud")
        # Style switch for avatar (writes into st.session_state['avatar_style'])
        st.radio("Style", ["Calm", "Dark"], key="avatar_style", horizontal=True,
                 label_visibility="collapsed")
        # Render avatar card (will glow/animate when speak() is called)
        render_avatar(width=560)

        st.toggle("Auto speak responses", value=st.session_state.auto_speak,
                  key="auto_speak", help="Joud will speak back when enabled.")

    with right:
        st.subheader("Chat with Joud")

        # Show existing history first
        for role, msg in st.session_state.chat_history:
            st.chat_message("user" if role == "you" else "assistant").write(msg)

        # Input box
        user_input = st.text_input("You:", placeholder="Type your message…")
        send = st.button("Send", use_container_width=True)

        if send and user_input.strip():
            # 1) Get LLM reply
            reply = chat_interface(user_input)
            st.session_state.chat_history.append(("you", user_input))
            st.session_state.chat_history.append(("joud", reply))

            # 2) Re-render full history
            st.experimental_rerun()

        # After rerun, speak the last assistant message (if enabled)
        if st.session_state.chat_history and st.session_state.auto_speak:
            role, msg = st.session_state.chat_history[-1]
            if role == "joud":
                persona = st.session_state.get("avatar_style", "Calm")
                speak(msg, persona=persona)


def mood_tab():
    st.subheader("Mood & Wellness")
    mood = st.selectbox("How do you feel?", ["😊 Great", "🙂 Okay", "😕 Low", "😡 Stressed"]) 
    if st.button("Log mood"):
        log_mood(mood)
        st.session_state["last_mood"] = mood
        st.success("Logged!")
    display_mood_chart()


def suggestions_tab():
    st.subheader("Smart Suggestions")
    # Build simple context for suggestions
    try:
        tasks = load_tasks()
    except Exception:
        tasks = []
    context = {
        "mood": st.session_state.get("last_mood"),
        "recent_tasks": tasks,
    }
    try:
        ideas = generate_suggestions(context=context)
    except TypeError:
        # Backward compatibility if generate_suggestions() takes no args
        ideas = generate_suggestions()
    except Exception as e:
        ideas = [f"Suggestion engine unavailable: {e}"]

    for s in ideas:
        st.write("• " + str(s))


def planner_tab():
    st.subheader("Planner")
    try:
        tasks = load_tasks()
    except Exception:
        tasks = []
    render_planner(tasks)
    new = st.text_input("New task")
    when = st.date_input("When")
    if st.button("Add task") and new.strip():
        try:
            add_task(new, when)
            st.success("Added")
        except Exception as e:
            st.error(f"Could not add task: {e}")


def finance_tab():
    st.subheader("Financial Advisor")
    try:
        pf = load_portfolio()
        st.json(pf)
    except Exception as e:
        st.warning(f"Portfolio not available: {e}")

    amt = st.number_input("Log expense (negative) / income (positive)", value=0.0, step=100.0)
    note = st.text_input("Note")
    if st.button("Save entry"):
        try:
            log_financials(amount=amt, note=note)
            st.success("Saved")
        except Exception as e:
            st.error(f"Could not save entry: {e}")

    st.write("Ideas:")
    try:
        for idea in suggest_investments(pf if 'pf' in locals() else {}):
            st.write("• " + str(idea))
    except Exception as e:
        st.write(f"No ideas right now: {e}")


def main():
    _init_state()
    st.title("🧠 Joud AI – Your Private AI Assistant")

    # Optional: also expose a sidebar control for avatar style
    with st.sidebar:
        st.markdown("### Avatar")
        avatar_style_selector()

    tabs = st.tabs(["🏠 Overview", "💬 Chat", "🧘 Mood & Wellness", "💡 Smart Suggestions", "🗓️ Planner", "💼 Financial Advisor"])
    with tabs[0]:
        overview_tab()
    with tabs[1]:
        chat_tab()
    with tabs[2]:
        mood_tab()
    with tabs[3]:
        suggestions_tab()
    with tabs[4]:
        planner_tab()
    with tabs[5]:
        finance_tab()


if __name__ == "__main__":
    main()