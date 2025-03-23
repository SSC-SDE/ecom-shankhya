import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
    })
    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d",
    })

    return { accessToken, refreshToken };
}

const storeRefreshToken = async (userId, refreshToken) => {
    await redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60) //7days
}

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true, //prevent XSS attacks, CROSS SITE SCRIPTING ATTACKS
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", //CSRF prevention attacks, CORS FORGERY REQUEST ATTACKS
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true, //prevent XSS attacks, CROSS SITE SCRIPTING ATTACKS
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", //CSRF prevention attacks, CORS FORGERY REQUEST ATTACKS
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

export const signup = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({
                message: "user already exists"
            })
        }
        const user = await User.create({ name, email, password });

        //Authenticate user
        const { accessToken, refreshToken } = generateTokens(user._id);
        await storeRefreshToken(user._id, refreshToken);

        setCookies(res, accessToken, refreshToken);

        res.status(201).json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            const { accessToken, refreshToken } = generateTokens(user._id)
            await storeRefreshToken(user._id, refreshToken);

            setCookies(res, accessToken, refreshToken);

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            })
        } else {
            res.status(400).json({ message: "Invalid email or password" });
        }

    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({
            message: error.message
        })
    }
};
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken
        if (refreshToken) {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            await redis.del(`refresh_token:${decoded.userId}`);
        }
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

//this will refresh access token
export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken

        if (!refreshToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

        const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

        res.cookie("accessToken", accessToken, {
            httpOnly: true, //prevent XSS attacks, CROSS SITE SCRIPTING ATTACKS
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict", //CSRF prevention attacks, CORS FORGERY REQUEST ATTACKS
            maxAge: 15 * 60 * 1000,
        });

        res.json({ message: "Token Refreshed Successfully" });

    } catch (error) {
        console.log("Error in Refresh token Controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}
//TODO: implement Get profile Later
// export const getProfile = async(req, res) => {

// }