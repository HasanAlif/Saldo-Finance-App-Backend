import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { borrowedService } from "./borrowed.service";
import { Request, Response } from "express";

const createBorrowed = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await borrowedService.createBorrowed(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Borrowed record created successfully",
    data: result,
  });
});

const getAllBorrowed = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await borrowedService.getAllBorrowed(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Borrowed records retrieved successfully",
    data: result,
  });
});

const getBorrowedById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await borrowedService.getBorrowedById(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Borrowed record retrieved successfully",
    data: result,
  });
});

const updateBorrowed = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await borrowedService.updateBorrowed(userId, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Borrowed record updated successfully",
    data: result,
  });
});

const deleteBorrowed = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  await borrowedService.deleteBorrowed(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Borrowed record deleted successfully",
    data: null,
  });
});

const addPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { amount } = req.body;
  const result = await borrowedService.addPayment(userId, id, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment added successfully",
    data: result,
  });
});

const markAsPaid = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await borrowedService.markAsPaid(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Debt marked as paid successfully",
    data: result,
  });
});

export const borrowedController = {
  createBorrowed,
  getAllBorrowed,
  getBorrowedById,
  updateBorrowed,
  deleteBorrowed,
  addPayment,
  markAsPaid,
};
